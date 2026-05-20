import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

class AgentCreate(BaseModel):
    name: str
    graph_config: dict[str, Any]


class AgentOut(BaseModel):
    id: uuid.UUID
    name: str
    graph_config: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Task
# ---------------------------------------------------------------------------

class TaskCreate(BaseModel):
    name: str
    category: str
    prompt_template: str
    scoring_fn: str
    expected_output: str | None = None
    metadata: dict[str, Any] = {}


class TaskOut(BaseModel):
    id: uuid.UUID
    name: str
    category: str
    prompt_template: str
    scoring_fn: str
    expected_output: str | None
    metadata: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm(cls, obj):
        return cls(
            id=obj.id,
            name=obj.name,
            category=obj.category,
            prompt_template=obj.prompt_template,
            scoring_fn=obj.scoring_fn,
            expected_output=obj.expected_output,
            metadata=obj.metadata_,
            created_at=obj.created_at,
        )


# ---------------------------------------------------------------------------
# EvalRun
# ---------------------------------------------------------------------------

class EvalRunOut(BaseModel):
    id: uuid.UUID
    agent_id: uuid.UUID
    task_id: uuid.UUID
    experiment_id: uuid.UUID | None
    status: str
    input_used: dict[str, Any]
    output: str | None
    score: float | None
    latency_ms: int | None
    tokens_used: int | None
    cost_usd: float | None
    error: str | None
    reasoning_steps: list[Any]
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Experiment
# ---------------------------------------------------------------------------

class ExperimentCreate(BaseModel):
    name: str
    agent_ids: list[uuid.UUID]
    task_ids: list[uuid.UUID]
    runs_per_combo: int = 1


class ExperimentOut(BaseModel):
    id: uuid.UUID
    name: str
    agent_ids: list[Any]
    task_ids: list[Any]
    runs_per_combo: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ExperimentDispatchOut(BaseModel):
    experiment_id: uuid.UUID
    run_ids: list[uuid.UUID]
    total: int


class ExperimentDetailOut(BaseModel):
    experiment: ExperimentOut
    runs: list[EvalRunOut]


# ---------------------------------------------------------------------------
# Leaderboard
# ---------------------------------------------------------------------------

class LeaderboardEntry(BaseModel):
    agent_id: uuid.UUID
    agent_name: str
    elo_score: float
    win_rate: float
    avg_score: float
    avg_latency_ms: float
    total_runs: int
    total_cost_usd: float
    snapshot_at: datetime


class AgentCategoryBreakdown(BaseModel):
    category: str
    avg_score: float
    total_runs: int
