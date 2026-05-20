import ast
import subprocess
import sys

from langchain_core.tools import tool


@tool
def calculator(expression: str) -> str:
    """Evaluate a simple arithmetic expression and return the result."""
    try:
        tree = ast.parse(expression, mode="eval")
        # Only allow safe node types
        allowed = {
            ast.Expression, ast.BinOp, ast.UnaryOp, ast.Constant,
            ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow, ast.Mod,
            ast.FloorDiv, ast.USub, ast.UAdd,
        }
        for node in ast.walk(tree):
            if type(node) not in allowed:
                return f"Error: disallowed expression node {type(node).__name__}"
        result = eval(compile(tree, "<string>", "eval"))  # noqa: S307
        return str(result)
    except Exception as e:
        return f"Error: {e}"


@tool
def code_exec(code: str) -> str:
    """Execute a Python code snippet and return stdout (5 second timeout)."""
    try:
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode != 0:
            return f"Error: {result.stderr.strip()}"
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        return "Error: code execution timed out"
    except Exception as e:
        return f"Error: {e}"


@tool
def web_search(query: str) -> str:
    """Search the web for information."""
    return "[web_search not available]"


TOOL_REGISTRY: dict[str, object] = {
    "calculator": calculator,
    "code_exec": code_exec,
    "web_search": web_search,
}


def get_tools(names: list[str]) -> list:
    unknown = [n for n in names if n not in TOOL_REGISTRY]
    if unknown:
        raise ValueError(f"Unknown tools: {unknown}")
    return [TOOL_REGISTRY[n] for n in names]
