import asyncio

import redis.asyncio as aioredis
from fastapi import WebSocket, WebSocketDisconnect

from app.config import settings


async def _forward(websocket: WebSocket, channel: str, stop_on_done: bool) -> None:
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    pubsub = r.pubsub()
    await pubsub.subscribe(channel)
    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=30)
            if message is None:
                # Send a keepalive ping so the browser doesn't time out
                await websocket.send_text('{"type":"ping"}')
                continue
            data = message["data"]
            await websocket.send_text(data)
            if stop_on_done:
                import json
                parsed = json.loads(data)
                if parsed.get("status") in ("done", "failed"):
                    break
    except WebSocketDisconnect:
        pass
    except Exception:
        await websocket.close(code=1011)
    finally:
        await pubsub.unsubscribe(channel)
        await r.aclose()


def register_ws_routes(app) -> None:
    @app.websocket("/ws/runs/{run_id}")
    async def ws_run(websocket: WebSocket, run_id: str):
        await websocket.accept()
        await _forward(websocket, f"run:{run_id}", stop_on_done=True)

    @app.websocket("/ws/leaderboard")
    async def ws_leaderboard(websocket: WebSocket):
        await websocket.accept()
        await _forward(websocket, "leaderboard", stop_on_done=False)
