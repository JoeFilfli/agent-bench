# AI Agent Evaluation Platform

A full-stack system for benchmarking AI agents across tasks. Define agents, define tasks, run experiments, and compare results on a live leaderboard.

---

## What it does

1. **Register agents** — each agent is a named config: model, temperature, system prompt, tools, and topology (ReAct, pipeline, debate, supervisor)
2. **Define tasks** — a prompt template, a set of sample inputs, and a scoring method
3. **Run experiments** — pick any combination of agents × tasks × N runs per pair; the system fans them all out in parallel via Celery workers and streams results live
4. **Rank on a leaderboard** — ELO scores are updated after every run; the leaderboard auto-refreshes

---

## Stack

| Layer | Tech |
|---|---|
| API | FastAPI + async SQLAlchemy 2.0 (asyncpg) |
| Workers | Celery + Redis, `NullPool` to avoid asyncio/fork conflicts |
| Agents | LangGraph (`create_react_agent`) + LangChain OpenAI |
| Database | PostgreSQL — 5 tables (agents, tasks, eval_runs, experiment_groups, leaderboard_snapshots) |
| Real-time | Redis pub/sub → WebSocket bridge |
| Frontend | React + TypeScript + Vite, Recharts, react-router-dom |
| Infra | Docker Compose (5 services) |

---

## Quick start

```bash
# 1. Copy env and add your OpenAI key
cp .env.example .env
# edit .env: set OPENAI_API_KEY

# 2. Start everything
docker compose up --build

# 3. Seed the task library (run once)
docker compose exec api python -m app.tasks_lib.seed

# 4. Open the UI
open http://localhost:5173
```

---

## Services

| Service | Port | Description |
|---|---|---|
| `frontend` | 5173 | Vite dev server (hot reload) |
| `api` | 8000 | FastAPI — REST + WebSocket |
| `worker` | — | Celery worker (8 concurrent) |
| `postgres` | 5432 | PostgreSQL |
| `redis` | 6379 | Celery broker + pub/sub |

---

## API

```
GET    /api/agents              list agents
POST   /api/agents              create agent
DELETE /api/agents/{id}         delete agent

GET    /api/tasks               list tasks

POST   /api/experiments         create + launch experiment
GET    /api/experiments         list experiments
GET    /api/experiments/{id}    detail + all runs
DELETE /api/experiments/{id}    delete experiment + runs

GET    /api/leaderboard         current rankings
GET    /api/leaderboard/{id}    per-category breakdown for one agent

WS     /ws/runs/{id}            live stream for a single run
WS     /ws/leaderboard          fires on every ELO update
```

---

## Agent config

Agents are stored as JSON. The `react` type is the simplest:

```json
{
  "type": "react",
  "model": "gpt-4o",
  "temperature": 0.0,
  "system_prompt": "Think step by step.",
  "tools": ["calculator", "code_exec"]
}
```

Other supported topologies: `pipeline`, `debate`, `supervisor`.

---

## Scoring

Each task uses the scorer best suited to its answer type:

| Scorer | Used for | How it works |
|---|---|---|
| `game_validator` | Towers of Hanoi | Deterministic Python state machine — simulates every move |
| `code_execution` | FizzBuzz, Palindrome, Fibonacci | Runs the agent's code against hardcoded test cases |
| `llm_judge` | All other tasks | GPT-4o with a `run_python` tool — computes to verify when possible, reasons when not |

The LLM judge runs in a tool loop: it can call `run_python` to verify arithmetic, simulate processes, or execute submitted code before producing a score.

```python
# Example rubric (reasoning task)
"Extract the numeric answer — ignore prose and formatting.
 Award 1.0 if it matches the expected answer. Award 0.0 otherwise."
```

---

## Task library (15 seeded tasks)

| Category | Tasks | Scorer |
|---|---|---|
| reasoning | Arithmetic Word Problem, Percentage Calculation, Unit Conversion | `llm_judge` |
| coding | FizzBuzz, Palindrome Checker, Fibonacci | `code_execution` |
| game | Towers of Hanoi (3 / 4 / 5 disks) | `game_validator` |
| simulation | Inventory Reorder Decision, Job Scheduling | `llm_judge` |
| multi_turn | Multi-turn Negotiation, Multi-turn Debugging Session | `llm_judge` |

---

## Cost tracking

Token counts are read from `AIMessage.usage_metadata` after each run. Cost is computed from a pricing table keyed by model:

| Model | Input | Output |
|---|---|---|
| gpt-4o | $2.50 / 1M | $10.00 / 1M |
| gpt-4o-mini | $0.15 / 1M | $0.60 / 1M |
| gpt-4-turbo | $10.00 / 1M | $30.00 / 1M |

---

## ELO ranking

After each run completes, the worker recomputes ELO for the agent:

1. Fetch per-task average scores for this agent and all opponents who ran the same tasks
2. For each head-to-head matchup per task: compute actual result (win/draw/loss) and expected result from current ratings
3. Apply `delta = K × Σ(actual − expected)` where K = 32
4. Write a new `leaderboard_snapshots` row

---

## Project structure

```
.
├── backend/
│   ├── app/
│   │   ├── agents/          # LangGraph agent builders (react, pipeline, debate, supervisor)
│   │   ├── models.py        # SQLAlchemy ORM models
│   │   ├── routers/         # FastAPI routers (agents, tasks, experiments, runs, leaderboard, ws)
│   │   ├── services/        # scoring.py, elo.py, runner.py
│   │   ├── tasks_lib/       # seed.py — 15 tasks
│   │   ├── tools/           # calculator, code_exec, web_search
│   │   └── worker.py        # Celery task (run_eval)
│   └── alembic/             # DB migrations
└── frontend/
    └── src/
        ├── components/      # NavBar, ui.tsx (design system)
        └── pages/           # Leaderboard, Agents, AgentDetail, Tasks,
                             # Experiments, NewExperiment, Experiment, RunMonitor
```
