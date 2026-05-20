import asyncio

from app.db import AsyncSessionLocal
from app.models import Task

TASKS = [
    # -------------------------------------------------------------------------
    # reasoning
    # -------------------------------------------------------------------------
    {
        "name": "Arithmetic Word Problem",
        "category": "reasoning",
        "prompt_template": (
            "A store sells {item} for ${price} each. "
            "{name} buys {qty} of them and pays with a ${bill} bill. "
            "How much change does {name} receive? Answer with a single number."
        ),
        "scoring_fn": "llm_judge",
        "expected_output": None,
        "metadata_": {
            "rubric": "Extract the numeric answer from the response — ignore prose, units, dollar signs, and formatting. Award 1.0 if the number matches the expected answer. Award 0.0 otherwise.",
            "inputs": [
                {"item": "apples", "price": 3, "name": "Alice", "qty": 4, "bill": 20, "expected_output": "8"},
                {"item": "notebooks", "price": 5, "name": "Bob", "qty": 3, "bill": 50, "expected_output": "35"},
                {"item": "pens", "price": 2, "name": "Carol", "qty": 7, "bill": 20, "expected_output": "6"},
            ]
        },
    },
    {
        "name": "Percentage Calculation",
        "category": "reasoning",
        "prompt_template": "What is {pct}% of {number}? Answer with a single number, no units.",
        "scoring_fn": "llm_judge",
        "expected_output": None,
        "metadata_": {
            "rubric": "Extract the numeric answer from the response — ignore prose, units, and formatting. Award 1.0 if the number matches the expected answer (allow minor floating point rounding). Award 0.0 otherwise.",
            "inputs": [
                {"pct": 15, "number": 240, "expected_output": "36"},
                {"pct": 30, "number": 850, "expected_output": "255"},
                {"pct": 7.5, "number": 1200, "expected_output": "90.0"},
            ]
        },
    },
    {
        "name": "Unit Conversion",
        "category": "reasoning",
        "prompt_template": "Convert {value} {from_unit} to {to_unit}. Answer with a single number, no units.",
        "scoring_fn": "llm_judge",
        "expected_output": None,
        "metadata_": {
            "rubric": "Extract the numeric answer from the response — ignore prose, units, and formatting. Award 1.0 if the number matches the expected answer (allow minor floating point rounding). Award 0.0 otherwise.",
            "inputs": [
                {"value": 5, "from_unit": "kilometers", "to_unit": "meters", "expected_output": "5000"},
                {"value": 2.5, "from_unit": "hours", "to_unit": "minutes", "expected_output": "150"},
                {"value": 1000, "from_unit": "grams", "to_unit": "kilograms", "expected_output": "1.0"},
            ]
        },
    },

    # -------------------------------------------------------------------------
    # coding
    # -------------------------------------------------------------------------
    {
        "name": "FizzBuzz",
        "category": "coding",
        "prompt_template": (
            "Write a Python function fizzbuzz(n) that returns a list of strings "
            "for numbers 1 to n. Use 'Fizz' for multiples of 3, 'Buzz' for multiples "
            "of 5, 'FizzBuzz' for both, and the number as a string otherwise. "
            "Return only the function definition inside a Python code block."
        ),
        "scoring_fn": "code_execution",
        "expected_output": None,
        "metadata_": {
            "inputs": [{}],
            "test_cases": [
                {"input": [5],  "expected": ["1", "2", "Fizz", "4", "Buzz"]},
                {"input": [15], "expected": ["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]},
            ],
        },
    },
    {
        "name": "Palindrome Checker",
        "category": "coding",
        "prompt_template": (
            "Write a Python function is_palindrome(s) that returns True if the string s "
            "is a palindrome (ignoring case and spaces), False otherwise. "
            "Return only the function definition inside a Python code block."
        ),
        "scoring_fn": "code_execution",
        "expected_output": None,
        "metadata_": {
            "inputs": [{}],
            "test_cases": [
                {"input": ["racecar"], "expected": True},
                {"input": ["hello"],   "expected": False},
                {"input": ["A man a plan a canal Panama"], "expected": True},
                {"input": ["Was it a car or a cat I saw"],  "expected": True},
            ],
        },
    },
    {
        "name": "Fibonacci",
        "category": "coding",
        "prompt_template": (
            "Write a Python function fibonacci(n) that returns a list of the first n "
            "Fibonacci numbers starting from 0. "
            "Return only the function definition inside a Python code block."
        ),
        "scoring_fn": "code_execution",
        "expected_output": None,
        "metadata_": {
            "inputs": [{}],
            "test_cases": [
                {"input": [1], "expected": [0]},
                {"input": [6], "expected": [0, 1, 1, 2, 3, 5]},
                {"input": [8], "expected": [0, 1, 1, 2, 3, 5, 8, 13]},
            ],
        },
    },

    # -------------------------------------------------------------------------
    # game
    # -------------------------------------------------------------------------
    {
        "name": "Towers of Hanoi — 3 disks",
        "category": "game",
        "prompt_template": (
            "Solve Towers of Hanoi with {disks} disks. "
            "Output every move on its own line as exactly: disk N: peg A → peg B "
            "(where A and B are one of A, B, C). Output moves only, nothing else."
        ),
        "scoring_fn": "game_validator",
        "expected_output": None,
        "metadata_": {
            "inputs": [{"disks": 3, "optimal_moves": 7}],
        },
    },
    {
        "name": "Towers of Hanoi — 4 disks",
        "category": "game",
        "prompt_template": (
            "Solve Towers of Hanoi with {disks} disks. "
            "Output every move on its own line as exactly: disk N: peg A → peg B "
            "(where A and B are one of A, B, C). Output moves only, nothing else."
        ),
        "scoring_fn": "game_validator",
        "expected_output": None,
        "metadata_": {
            "inputs": [{"disks": 4, "optimal_moves": 15}],
        },
    },
    {
        "name": "Towers of Hanoi — 5 disks",
        "category": "game",
        "prompt_template": (
            "Solve Towers of Hanoi with {disks} disks. "
            "Output every move on its own line as exactly: disk N: peg A → peg B "
            "(where A and B are one of A, B, C). Output moves only, nothing else."
        ),
        "scoring_fn": "game_validator",
        "expected_output": None,
        "metadata_": {
            "inputs": [{"disks": 5, "optimal_moves": 31}],
        },
    },

    # -------------------------------------------------------------------------
    # simulation
    # -------------------------------------------------------------------------
    {
        "name": "Inventory Reorder Decision",
        "category": "simulation",
        "prompt_template": (
            "You manage a warehouse. Current stock={stock} units, daily demand={demand} units, "
            "lead time={lead_time} days, holding cost=${holding_cost}/unit/day. "
            "Should you reorder today? If yes, how many units? "
            "Justify your answer with the reorder point calculation."
        ),
        "scoring_fn": "llm_judge",
        "expected_output": None,
        "metadata_": {
            "rubric": (
                "Award 1.0 if the agent correctly calculates the reorder point "
                "(reorder point = daily_demand × lead_time) and gives the right yes/no decision. "
                "Award 0.5 if the decision is correct but the justification is missing or wrong. "
                "Award 0.0 if the decision is wrong."
            ),
            "inputs": [
                {"stock": 50, "demand": 8, "lead_time": 3, "holding_cost": 2},
                {"stock": 100, "demand": 15, "lead_time": 5, "holding_cost": 3},
            ],
        },
    },
    {
        "name": "Job Scheduling",
        "category": "simulation",
        "prompt_template": (
            "You have {num_jobs} jobs to schedule on a single machine. "
            "Each job has a processing time and a deadline (in hours from now): {jobs}. "
            "Give a schedule that minimises the number of late jobs. "
            "List the jobs in the order you would run them."
        ),
        "scoring_fn": "llm_judge",
        "expected_output": None,
        "metadata_": {
            "rubric": (
                "The expected_output field gives the minimum number of late jobs achievable for this input. "
                "Award 1.0 if the agent's schedule achieves that minimum late-job count and verifies each job's completion time. "
                "Award 0.5 if the agent gives a valid schedule but with more late jobs than the minimum, or skips the verification. "
                "Award 0.0 if the schedule is wrong or no reasoning is given."
            ),
            "inputs": [
                {
                    "num_jobs": 4,
                    "jobs": "J1(2h, deadline 3h), J2(1h, deadline 2h), J3(3h, deadline 5h), J4(1h, deadline 4h)",
                    "expected_output": "1 late job. Optimal schedule: J2, J1, J4, J3.",
                },
                {
                    "num_jobs": 3,
                    "jobs": "J1(4h, deadline 4h), J2(2h, deadline 6h), J3(1h, deadline 3h)",
                    "expected_output": "1 late job. Optimal schedule: J3, J2, J1.",
                },
            ],
        },
    },

    # -------------------------------------------------------------------------
    # multi_turn (stubs — environment_state scorer returns 0.0)
    # -------------------------------------------------------------------------
    {
        "name": "Multi-turn Negotiation",
        "category": "multi_turn",
        "prompt_template": (
            "You are negotiating the price of a {item}. "
            "The seller is asking ${asking_price}. Your budget is ${budget}. "
            "Try to reach a deal. Start by making an offer."
        ),
        "scoring_fn": "llm_judge",
        "expected_output": None,
        "metadata_": {
            "rubric": (
                "Award 1.0 if the agent makes a reasonable opening offer below the asking price and within budget, "
                "with clear justification. Award 0.5 if an offer is made but poorly justified. "
                "Award 0.0 if no offer is made or the offer exceeds the budget."
            ),
            "inputs": [
                {"item": "used laptop", "asking_price": 800, "budget": 600},
            ],
        },
    },
    {
        "name": "Multi-turn Debugging Session",
        "category": "multi_turn",
        "prompt_template": (
            "You are a senior engineer helping debug a {language} program. "
            "The error is: {error}. Ask clarifying questions and guide the user to a fix."
        ),
        "scoring_fn": "llm_judge",
        "expected_output": None,
        "metadata_": {
            "rubric": (
                "Award 1.0 if the response correctly identifies that the error is caused by mixing int and str types "
                "and suggests a clear fix (e.g. str() or int() conversion). "
                "Award 0.5 if the diagnosis is vague but plausible. "
                "Award 0.0 if the response is wrong or unhelpful."
            ),
            "inputs": [
                {"language": "Python", "error": "TypeError: unsupported operand type(s) for +: 'int' and 'str'"},
            ],
        },
    },
]


async def seed() -> None:
    from sqlalchemy import select
    async with AsyncSessionLocal() as db:
        added = 0
        for task_data in TASKS:
            existing = (await db.execute(
                select(Task).where(Task.name == task_data["name"])
            )).scalar_one_or_none()
            if existing is None:
                db.add(Task(
                    name=task_data["name"],
                    category=task_data["category"],
                    prompt_template=task_data["prompt_template"],
                    scoring_fn=task_data["scoring_fn"],
                    expected_output=task_data.get("expected_output"),
                    metadata_=task_data["metadata_"],
                ))
                added += 1
        await db.commit()
        print(f"Seeded {added} tasks ({len(TASKS) - added} already existed).")


if __name__ == "__main__":
    asyncio.run(seed())
