from langchain_core.messages import SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

from app.tools.registry import get_tools


def build_react_agent(config: dict):
    model = ChatOpenAI(
        model=config.get("model", "gpt-4o"),
        temperature=config.get("temperature", 0.0),
    )
    tools = get_tools(config.get("tools", []))
    system_prompt = config.get("system_prompt", "")

    return create_react_agent(
        model=model,
        tools=tools,
        prompt=SystemMessage(content=system_prompt) if system_prompt else None,
    )
