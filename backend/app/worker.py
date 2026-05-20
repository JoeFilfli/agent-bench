import asyncio
import json
from datetime import datetime, timezone

import redis as sync_redis
from celery import Celery
from openai import APIConnectionError, RateLimitError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings

celery_app = Celery(
    "eval_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)

_redis = sync_redis.from_url(settings.REDIS_URL, decode_responses=True)

# NullPool: no connection reuse across asyncio.run() calls in forked worker processes
_worker_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
_WorkerSession = async_sessionmaker(_worker_engine, class_=AsyncSession, expire_on_commit=False)


def _publish(channel: str, payload: dict) -> None:
    _redis.publish(channel, json.dumps(payload))


def _run(coro):
    return asyncio.run(coro)


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=10,
)
def run_eval(self, run_id: str) -> None:
    from app.models import Agent, EvalRun, ExperimentGroup, Task
    from app.services.runner import execute_single

    async def _execute():
        async with _WorkerSession() as db:
            # Fetch run with agent and task
            stmt = (
                select(EvalRun)
                .where(EvalRun.id == run_id)
            )
            run = (await db.execute(stmt)).scalar_one()
            agent = await db.get(Agent, run.agent_id)
            task = await db.get(Task, run.task_id)

            # Mark running
            run.status = "running"
            await db.commit()
            _publish(f"run:{run_id}", {"status": "running", "run_id": run_id})

            task_dict = {
                "prompt_template": task.prompt_template,
                "scoring_fn": task.scoring_fn,
                "expected_output": task.expected_output,
                "metadata_": task.metadata_,
            }

            result = await execute_single(agent.graph_config, task_dict, run.input_used)

            # Persist result
            run.output = result.output
            run.score = result.score
            run.latency_ms = result.latency_ms
            run.tokens_used = result.tokens_used
            run.cost_usd = result.cost_usd
            run.reasoning_steps = result.reasoning_steps
            run.completed_at = datetime.now(timezone.utc)

            if result.error:
                run.status = "failed"
                run.error = result.error
                await db.commit()
                _publish(f"run:{run_id}", {"status": "failed", "run_id": run_id, "error": result.error})
            else:
                run.status = "done"
                await db.commit()
                _publish(f"run:{run_id}", {"status": "done", "run_id": run_id, "score": result.score})

            # Mark experiment done when all its runs have finished
            if run.experiment_id:
                remaining = (await db.execute(
                    select(EvalRun).where(
                        EvalRun.experiment_id == run.experiment_id,
                        EvalRun.status.notin_(["done", "failed"]),
                    )
                )).scalars().first()
                if remaining is None:
                    exp = await db.get(ExperimentGroup, run.experiment_id)
                    if exp:
                        exp.status = "done"
                        await db.commit()

        # Update ELO outside the DB session (pass NullPool factory to avoid event loop conflicts)
        from app.services.elo import update_elo
        await update_elo(run.agent_id, session_factory=_WorkerSession)

    try:
        _run(_execute())
    except (RateLimitError, APIConnectionError) as exc:
        raise self.retry(exc=exc)
