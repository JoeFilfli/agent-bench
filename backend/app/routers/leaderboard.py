import uuid
from typing import Sequence

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Agent, EvalRun, LeaderboardSnapshot, Task
from app.schemas import AgentCategoryBreakdown, LeaderboardEntry

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get("", response_model=list[LeaderboardEntry])
async def get_leaderboard(db: AsyncSession = Depends(get_db)):
    # Latest snapshot per agent
    subq = (
        select(
            LeaderboardSnapshot.agent_id,
            func.max(LeaderboardSnapshot.snapshot_at).label("latest"),
        )
        .group_by(LeaderboardSnapshot.agent_id)
        .subquery()
    )
    stmt = (
        select(LeaderboardSnapshot, Agent.name.label("agent_name"))
        .join(subq, (LeaderboardSnapshot.agent_id == subq.c.agent_id) &
              (LeaderboardSnapshot.snapshot_at == subq.c.latest))
        .join(Agent, Agent.id == LeaderboardSnapshot.agent_id)
        .order_by(LeaderboardSnapshot.elo_score.desc())
    )
    rows = (await db.execute(stmt)).all()

    return [
        LeaderboardEntry(
            agent_id=row.LeaderboardSnapshot.agent_id,
            agent_name=row.agent_name,
            elo_score=row.LeaderboardSnapshot.elo_score,
            win_rate=row.LeaderboardSnapshot.win_rate,
            avg_score=row.LeaderboardSnapshot.avg_score,
            avg_latency_ms=row.LeaderboardSnapshot.avg_latency_ms,
            total_runs=row.LeaderboardSnapshot.total_runs,
            total_cost_usd=row.LeaderboardSnapshot.total_cost_usd,
            snapshot_at=row.LeaderboardSnapshot.snapshot_at,
        )
        for row in rows
    ]


@router.get("/{agent_id}", response_model=list[AgentCategoryBreakdown])
async def get_agent_breakdown(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    stmt = (
        select(
            Task.category,
            func.avg(EvalRun.score).label("avg_score"),
            func.count(EvalRun.id).label("total_runs"),
        )
        .join(Task, Task.id == EvalRun.task_id)
        .where(EvalRun.agent_id == agent_id, EvalRun.status == "done")
        .group_by(Task.category)
        .order_by(Task.category)
    )
    rows = (await db.execute(stmt)).all()

    return [
        AgentCategoryBreakdown(
            category=row.category,
            avg_score=round(row.avg_score or 0.0, 4),
            total_runs=row.total_runs,
        )
        for row in rows
    ]
