import json
import re
import subprocess
import sys
import textwrap
from typing import Callable

from openai import AsyncOpenAI

_openai = AsyncOpenAI()

_JUDGE_MODEL = "gpt-4o"
_JUDGE_MAX_TOOL_ROUNDS = 5

_JUDGE_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "run_python",
            "description": (
                "Execute Python code and return its stdout. "
                "Use this to verify arithmetic, simulate processes, run submitted code against inputs, "
                "or check any claim that can be confirmed computationally."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {"type": "string", "description": "Python code to execute."}
                },
                "required": ["code"],
            },
        },
    }
]

_JUDGE_SYSTEM = (
    "You are a precise evaluator. You have access to a Python execution tool. "
    "Use it whenever you need to verify computations, simulate a process, or run code to check correctness — "
    "do not guess at results you can compute. "
    "After your evaluation, output ONLY a single float between 0.0 and 1.0 on its own line."
)


def _run_python_safe(code: str) -> str:
    try:
        proc = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True, text=True, timeout=10,
        )
        out = proc.stdout.strip()
        err = proc.stderr.strip()
        if proc.returncode != 0:
            return f"Error:\n{err}"
        return out or "(no output)"
    except subprocess.TimeoutExpired:
        return "Error: timeout after 10s"
    except Exception as exc:
        return f"Error: {exc}"


# ---------------------------------------------------------------------------
# exact_match
# ---------------------------------------------------------------------------

async def score_exact_match(output: str, metadata: dict) -> float:
    expected = str(metadata.get("expected_output", "")).strip()
    return 1.0 if output.strip() == expected else 0.0


# ---------------------------------------------------------------------------
# contains
# ---------------------------------------------------------------------------

async def score_contains(output: str, metadata: dict) -> float:
    expected = str(metadata.get("expected_output", ""))
    return 1.0 if expected in output else 0.0


# ---------------------------------------------------------------------------
# llm_judge  (gpt-4o + run_python tool)
# ---------------------------------------------------------------------------

async def score_llm_judge(output: str, metadata: dict) -> float:
    rubric = metadata.get("rubric", "Score the answer 0.0 to 1.0.")
    expected = metadata.get("expected_output")
    expected_line = f"Expected output: {expected}\n\n" if expected else ""
    user_msg = (
        f"Rubric: {rubric}\n\n"
        f"{expected_line}"
        f"Answer to evaluate:\n{output}\n\n"
        "Use run_python whenever you need to verify something computationally. "
        "Then reply with a single float between 0.0 and 1.0 and nothing else."
    )

    messages = [
        {"role": "system", "content": _JUDGE_SYSTEM},
        {"role": "user", "content": user_msg},
    ]

    for _ in range(_JUDGE_MAX_TOOL_ROUNDS):
        response = await _openai.chat.completions.create(
            model=_JUDGE_MODEL,
            messages=messages,
            tools=_JUDGE_TOOLS,
            temperature=0.0,
        )
        choice = response.choices[0]
        msg = choice.message

        if choice.finish_reason == "tool_calls":
            messages.append(msg)
            for tc in msg.tool_calls:
                code = json.loads(tc.function.arguments).get("code", "")
                result = _run_python_safe(code)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result,
                })
            continue

        raw = (msg.content or "").strip()
        try:
            return max(0.0, min(1.0, float(raw)))
        except ValueError:
            match = re.search(r"\d+\.?\d*", raw)
            return max(0.0, min(1.0, float(match.group()))) if match else 0.0

    return 0.0


# ---------------------------------------------------------------------------
# code_execution
# ---------------------------------------------------------------------------

def _extract_code(output: str) -> str:
    match = re.search(r"```(?:python)?\n(.*?)```", output, re.DOTALL)
    return match.group(1).strip() if match else output.strip()


async def score_code_execution(output: str, metadata: dict) -> float:
    code = _extract_code(output)
    test_cases = metadata.get("test_cases", [])
    if not test_cases:
        return 0.0

    passed = 0
    for case in test_cases:
        args = case.get("input", [])
        expected = case.get("expected")
        harness = textwrap.dedent(f"""
            {code}

            import inspect as _inspect
            _fns = [v for k, v in list(vars().items()) if callable(v) and not k.startswith('_') and not _inspect.isbuiltin(v) and not _inspect.isclass(v)]
            result = _fns[0](*{args!r}) if _fns else None
            print(repr(result))
        """)
        try:
            proc = subprocess.run(
                [sys.executable, "-c", harness],
                capture_output=True, text=True, timeout=5
            )
            result_repr = proc.stdout.strip()
            if repr(expected) == result_repr:
                passed += 1
        except (subprocess.TimeoutExpired, Exception):
            pass

    return passed / len(test_cases)


# ---------------------------------------------------------------------------
# game_validator — Towers of Hanoi
# ---------------------------------------------------------------------------

def _validate_hanoi(moves: list[tuple[int, int, int]], disks: int, optimal_moves: int | None = None) -> float:
    if not moves:
        return 0.0

    pegs: dict[int, list[int]] = {1: list(range(disks, 0, -1)), 2: [], 3: []}

    for disk, src, dst in moves:
        src_top = pegs[src][-1] if pegs[src] else None
        dst_top = pegs[dst][-1] if pegs[dst] else None
        if src_top != disk or (dst_top is not None and dst_top < disk):
            return 0.0  # illegal move
        pegs[src].pop()
        pegs[dst].append(disk)

    solved = pegs[3] == list(range(disks, 0, -1))
    if not solved:
        return 0.5

    if optimal_moves is not None and len(moves) == optimal_moves:
        return 1.0
    return 0.75


def _parse_hanoi_moves(output: str) -> list[tuple[int, int, int]]:
    peg_map = {"A": 1, "B": 2, "C": 3, "1": 1, "2": 2, "3": 3}
    moves = []
    # matches: "disk N: peg A → peg B" or "disk N: A -> B"
    pattern = re.compile(
        r"disk\s+(\d+)\s*[:\-]?\s*(?:peg\s*)?([ABC123])\s*[→\->]+\s*(?:peg\s*)?([ABC123])",
        re.IGNORECASE,
    )
    for m in pattern.finditer(output):
        disk = int(m.group(1))
        src = peg_map.get(m.group(2).upper(), 0)
        dst = peg_map.get(m.group(3).upper(), 0)
        if src and dst:
            moves.append((disk, src, dst))
    return moves


async def score_game(output: str, metadata: dict) -> float:
    validator = metadata.get("validator", "hanoi")
    if validator == "hanoi":
        disks = int(metadata.get("disks", 3))
        optimal = metadata.get("optimal_moves")
        optimal = int(optimal) if optimal is not None else None
        moves = _parse_hanoi_moves(output)
        return _validate_hanoi(moves, disks, optimal)
    return 0.0


# ---------------------------------------------------------------------------
# simulation_eval / environment_state — stubs
# ---------------------------------------------------------------------------

async def score_simulation(output: str, metadata: dict) -> float:
    return 0.0


async def score_environment(output: str, metadata: dict) -> float:
    return 0.0


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

SCORERS: dict[str, Callable] = {
    "exact_match":       score_exact_match,
    "contains":          score_contains,
    "llm_judge":         score_llm_judge,
    "code_execution":    score_code_execution,
    "game_validator":    score_game,
    "simulation_eval":   score_simulation,
    "environment_state": score_environment,
}


async def score_output(task: dict, agent_output: str, input_used: dict = {}) -> float:
    fn_name = task.get("scoring_fn")
    fn = SCORERS.get(fn_name)
    if fn is None:
        raise ValueError(f"Unknown scoring_fn: {fn_name!r}. Must be one of: {list(SCORERS)}")
    metadata = {**task.get("metadata_", task.get("metadata", {})), **input_used}
    return await fn(output=agent_output, metadata=metadata)
