from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import agents, experiments, leaderboard, runs, tasks
from app.routers.ws import register_ws_routes

app = FastAPI(title="AI Agent Evaluation Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(runs.router, prefix="/api")
app.include_router(experiments.router, prefix="/api")
app.include_router(leaderboard.router, prefix="/api")

register_ws_routes(app)


@app.get("/health")
async def health():
    return {"status": "ok"}
