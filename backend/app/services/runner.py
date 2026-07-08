import time
from dataclasses import dataclass, field

from langchain_core.messages import AIMessage

# USD per 1M tokens: (input, output)
_PRICING: dict[str, tuple[float, float]] = {
    "gpt-4o":             (2.50,  10.00),
    "gpt-4o-mini":        (0.15,   0.60),
    "gpt-4-turbo":       (10.00,  30.00),
    "gpt-4":             (30.00,  60.00),
    "gpt-3.5-turbo":      (0.50,   1.50),
    "o1":                (15.00,  60.00),
    "o1-mini":            (3.00,  12.00),
    "o3-mini":            (1.10,   4.40),
}


def _compute_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    # Normalise e.g. "gpt-4o-2024-08-06" → "gpt-4o"
    for key in _PRICING:
        if model.startswith(key):
            in_price, out_price = _PRICING[key]
            return (input_tokens * in_price + output_tokens * out_price) / 1_000_000
    return 0.0


def _extract_tokens(messages: list) -> tuple[int, int]:
    input_tokens = output_tokens = 0
    for msg in messages:
        if isinstance(msg, AIMessage) and msg.usage_metadata:
            input_tokens += msg.usage_metadata.get("input_tokens", 0)
            output_tokens += msg.usage_metadata.get("output_tokens", 0)
    return input_tokens, output_tokens


@dataclass
class RunResult:
    output: str
    score: float
    latency_ms: int
    tokens_used: int
    cost_usd: float
    reasoning_steps: list
    error: str | None


async def execute_single(agent_config: dict, task: dict, input_used: dict) -> RunResult:
    from app.agents.registry import get_agent
    from app.services.scoring import score_output

    agent = get_agent(agent_config)
    prompt = task["prompt_template"].format(**input_used)
    start = time.time()

    try:
        result = await agent.ainvoke({
            "messages": [{"role": "user", "content": prompt}],
            "task": prompt,
            "output": "",
            "reasoning_steps": [],
            "tool_calls": [],
            "round": 0,
        })

        messages = result["messages"]
        output = messages[-1].content
        latency = int((time.time() - start) * 1000)
        score = await score_output(task, output, input_used)

        input_tok, output_tok = _extract_tokens(messages)
        model = agent_config.get("model", "gpt-4o")

        return RunResult(
            output=output,
            score=score,
            latency_ms=latency,
            tokens_used=input_tok + output_tok,
            cost_usd=_compute_cost(model, input_tok, output_tok),
            reasoning_steps=result.get("reasoning_steps", []),
            error=None,
        )

    except Exception as e:
        return RunResult(
            output="",
            score=0.0,
            latency_ms=int((time.time() - start) * 1000),
            tokens_used=0,
            cost_usd=0.0,
            reasoning_steps=[],
            error=str(e),
        )
