import ast
import html
import re
import subprocess
import sys
import urllib.parse

import httpx
from langchain_core.tools import tool

_RESULT_LINK_RE = re.compile(
    r'<a rel="nofollow" class="result__a"[^>]*href="(?P<href>[^"]*)"[^>]*>(?P<title>.*?)</a>',
    re.DOTALL,
)
_SNIPPET_RE = re.compile(
    r'class="result__snippet"[^>]*>(?P<snippet>.*?)</a>',
    re.DOTALL,
)


def _clean_html(fragment: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", fragment)).strip()


def _resolve_url(raw_href: str) -> str:
    if raw_href.startswith("//"):
        raw_href = "https:" + raw_href
    qs = urllib.parse.parse_qs(urllib.parse.urlparse(raw_href).query)
    return qs["uddg"][0] if "uddg" in qs else raw_href


@tool
def calculator(expression: str) -> str:
    """Evaluate a simple arithmetic expression and return the result."""
    try:
        tree = ast.parse(expression.replace("^", "**"), mode="eval")
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
    """Search the web for information and return the top results."""
    try:
        response = httpx.get(
            "https://html.duckduckgo.com/html/",
            params={"q": query},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=10,
        )
        response.raise_for_status()
    except Exception as e:
        return f"Error: web search failed ({e})"

    titles = _RESULT_LINK_RE.findall(response.text)
    snippets = _SNIPPET_RE.findall(response.text)
    if not titles:
        return "No results found."

    results = []
    for i, (href, title) in enumerate(titles[:5]):
        url = _resolve_url(href)
        snippet = _clean_html(snippets[i]) if i < len(snippets) else ""
        results.append(f"{i + 1}. {_clean_html(title)} ({url})\n   {snippet}")
    return "\n".join(results)


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
