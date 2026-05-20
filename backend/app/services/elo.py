import json
import uuid
from collections import defaultdict

import redis.asyncio as aioredis
from sqlalchemy import func, select

from app.config import settings

K = 32


def _expected(rating_a: float, rating_b: float) -> float:
    return 1.0 / (1.0 + 10 ** ((rating_b - rating_a) / 400.0))


async def update_elo(agent_id: uuid.UUID, session_factory=None) -> None:
    from app.models import EvalRun, LeaderboardSnapshot

    if session_factory is None:
        from app.db import AsyncSessionLocal
        session_factory = AsyncSessionLocal

    async with session_factory() as db:
        # --- Aggregate stats for this agent ---
        stats_stmt = select(
            func.avg(EvalRun.score).label("avg_score"),
            func.avg(EvalRun.latency_ms).label("avg_latency_ms"),
            func.count(EvalRun.id).label("total_runs"),
            func.sum(EvalRun.cost_usd).label("total_cost_usd"),
        ).where(EvalRun.agent_id == agent_id, EvalRun.status == "done")

        stats = (await db.execute(stats_stmt)).one()

        total_runs = stats.total_runs or 0
        if total_runs == 0:
            return

        avg_score = float(stats.avg_score or 0.0)
        avg_latency_ms = float(stats.avg_latency_ms or 0.0)
        total_cost_usd = float(stats.total_cost_usd or 0.0)

        # --- Fetch or create this agent's snapshot ---
        snapshot_stmt = (
            select(LeaderboardSnapshot)
            .where(LeaderboardSnapshot.agent_id == agent_id)
            .order_by(LeaderboardSnapshot.snapshot_at.desc())
            .limit(1)
        )
        snapshot = (await db.execute(snapshot_stmt)).scalar_one_or_none()
        current_elo = snapshot.elo_score if snapshot else 1000.0

        # --- Per-task avg scores for this agent ---
        my_scores_stmt = select(
            EvalRun.task_id,
            func.avg(EvalRun.score).label("avg_score"),
        ).where(
            EvalRun.agent_id == agent_id,
            EvalRun.status == "done",
        ).group_by(EvalRun.task_id)

        my_scores: dict[uuid.UUID, float] = {
            row.task_id: float(row.avg_score)
            for row in (await db.execute(my_scores_stmt)).all()
        }

        # --- Find all other agents that ran the same tasks ---
        other_stmt = select(
            EvalRun.agent_id,
            EvalRun.task_id,
            func.avg(EvalRun.score).label("avg_score"),
        ).where(
            EvalRun.agent_id != agent_id,
            EvalRun.task_id.in_(list(my_scores.keys())),
            EvalRun.status == "done",
        ).group_by(EvalRun.agent_id, EvalRun.task_id)

        other_rows = (await db.execute(other_stmt)).all()

        # Group by opponent agent_id
        opponent_task_scores: dict[uuid.UUID, dict[uuid.UUID, float]] = defaultdict(dict)
        for row in other_rows:
            opponent_task_scores[row.agent_id][row.task_id] = float(row.avg_score)

        # --- Fetch opponent current ELO ratings ---
        if opponent_task_scores:
            opp_ids = list(opponent_task_scores.keys())
            opp_elo_stmt = (
                select(
                    LeaderboardSnapshot.agent_id,
                    LeaderboardSnapshot.elo_score,
                    func.max(LeaderboardSnapshot.snapshot_at),
                )
                .where(LeaderboardSnapshot.agent_id.in_(opp_ids))
                .group_by(LeaderboardSnapshot.agent_id, LeaderboardSnapshot.elo_score)
            )
            opp_elo: dict[uuid.UUID, float] = {
                row.agent_id: row.elo_score
                for row in (await db.execute(opp_elo_stmt)).all()
            }
        else:
            opp_elo = {}

        # --- Compute ELO delta across all matchups ---
        elo_delta = 0.0
        wins = 0
        total_matchups = 0

        for opp_id, task_scores in opponent_task_scores.items():
            opp_rating = opp_elo.get(opp_id, 1000.0)
            for task_id, opp_score in task_scores.items():
                my_score = my_scores.get(task_id, 0.0)
                actual = 1.0 if my_score > opp_score else (0.5 if my_score == opp_score else 0.0)
                expected = _expected(current_elo, opp_rating)
                elo_delta += K * (actual - expected)
                if actual == 1.0:
                    wins += 1
                total_matchups += 1

        new_elo = current_elo + elo_delta
        win_rate = wins / total_matchups if total_matchups > 0 else 0.0

        # --- Write new snapshot ---
        new_snapshot = LeaderboardSnapshot(
            agent_id=agent_id,
            elo_score=new_elo,
            win_rate=win_rate,
            avg_score=avg_score,
            avg_latency_ms=avg_latency_ms,
            total_runs=total_runs,
            total_cost_usd=total_cost_usd,
        )
        db.add(new_snapshot)
        await db.commit()

    # --- Publish to Redis ---
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    await r.publish("leaderboard", json.dumps({
        "event": "leaderboard_updated",
        "agent_id": str(agent_id),
    }))
    await r.aclose()
