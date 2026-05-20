import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Task
from app.schemas import TaskCreate, TaskOut

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("", response_model=TaskOut, status_code=201)
async def create_task(body: TaskCreate, db: AsyncSession = Depends(get_db)):
    task = Task(
        name=body.name,
        category=body.category,
        prompt_template=body.prompt_template,
        scoring_fn=body.scoring_fn,
        expected_output=body.expected_output,
        metadata_=body.metadata,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return TaskOut.from_orm(task)


@router.get("", response_model=list[TaskOut])
async def list_tasks(
    category: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Task).order_by(Task.created_at.desc())
    if category:
        stmt = stmt.where(Task.category == category)
    result = await db.execute(stmt)
    return [TaskOut.from_orm(t) for t in result.scalars().all()]


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(task_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskOut.from_orm(task)
