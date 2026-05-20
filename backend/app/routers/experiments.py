import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Agent, EvalRun, ExperimentGroup, Task
from app.schemas import (
    ExperimentCreate,
    ExperimentDetailOut,
    ExperimentDispatchOut,
    ExperimentOut,
    EvalRunOut,
)

router = APIRouter(prefix="/experiments", tags=["experiments"])


@router.post("", response_model=ExperimentDispatchOut, status_code=201)
async def create_experiment(body: ExperimentCreate, db: AsyncSession = Depends(get_db)):
    from app.worker import run_eval

    # Validate all agents and tasks exist
    for agent_id in body.agent_ids:
        if not await db.get(Agent, agent_id):
            raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
    for task_id in body.task_ids:
        task = await db.get(Task, task_id)
        if not task:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    # Create experiment group
    experiment = ExperimentGroup(
        name=body.name,
        agent_ids=[str(a) for a in body.agent_ids],
        task_ids=[str(t) for t in body.task_ids],
        runs_per_combo=body.runs_per_combo,
        status="running",
    )
    db.add(experiment)
    await db.flush()  # get experiment.id before creating runs

    # Fan out: agent × task × runs_per_combo
    run_ids = []
    for agent_id in body.agent_ids:
        for task_id in body.task_ids:
            task = await db.get(Task, task_id)
            inputs = task.metadata_.get("inputs", [{}])
            for i in range(body.runs_per_combo):
                input_used = inputs[i % len(inputs)] if inputs else {}
                run = EvalRun(
                    agent_id=agent_id,
                    task_id=task_id,
                    experiment_id=experiment.id,
                    status="pending",
                    input_used=input_used,
                )
                db.add(run)
                await db.flush()
                run_ids.append(run.id)

    await db.commit()

    # Enqueue all Celery tasks after commit so IDs are persisted
    for run_id in run_ids:
        run_eval.delay(str(run_id))

    return ExperimentDispatchOut(
        experiment_id=experiment.id,
        run_ids=run_ids,
        total=len(run_ids),
    )


@router.get("", response_model=list[ExperimentOut])
async def list_experiments(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ExperimentGroup).order_by(ExperimentGroup.created_at.desc())
    )
    return [ExperimentOut.model_validate(e) for e in result.scalars().all()]


@router.get("/{experiment_id}", response_model=ExperimentDetailOut)
async def get_experiment(experiment_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    experiment = await db.get(ExperimentGroup, experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    result = await db.execute(
        select(EvalRun)
        .where(EvalRun.experiment_id == experiment_id)
        .order_by(EvalRun.created_at)
    )
    runs = result.scalars().all()

    return ExperimentDetailOut(
        experiment=ExperimentOut.model_validate(experiment),
        runs=[EvalRunOut.model_validate(r) for r in runs],
    )


@router.delete("/{experiment_id}", status_code=204)
async def delete_experiment(experiment_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    experiment = await db.get(ExperimentGroup, experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    await db.execute(delete(EvalRun).where(EvalRun.experiment_id == experiment_id))
    await db.delete(experiment)
    await db.commit()
    return Response(status_code=204)
