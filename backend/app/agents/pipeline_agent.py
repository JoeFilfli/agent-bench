from typing import Annotated, TypedDict

from langchain_core.messages import SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages


class PipelineState(TypedDict):
    messages: Annotated[list, add_messages]
    task: str
    output: str
    reasoning_steps: list
    tool_calls: list


def build_pipeline(config: dict):
    agents_cfg = config.get("agents", [])

    def make_node(agent_cfg: dict):
        model = ChatOpenAI(
            model=agent_cfg.get("model", "gpt-4o"),
            temperature=agent_cfg.get("temperature", 0.0),
        )
        system_prompt = agent_cfg.get("system_prompt", "")
        role = agent_cfg.get("role", "agent")

        async def node(state: PipelineState) -> dict:
            msgs = []
            if system_prompt:
                msgs.append(SystemMessage(content=system_prompt))
            msgs.extend(state["messages"])
            response = await model.ainvoke(msgs)
            steps = state.get("reasoning_steps", [])
            steps.append({"role": role, "content": response.content})
            return {
                "messages": [response],
                "output": response.content,
                "reasoning_steps": steps,
            }

        node.__name__ = role
        return node

    builder = StateGraph(PipelineState)

    node_names = []
    for agent_cfg in agents_cfg:
        name = agent_cfg.get("role", f"agent_{len(node_names)}")
        builder.add_node(name, make_node(agent_cfg))
        node_names.append(name)

    builder.set_entry_point(node_names[0])
    for i in range(len(node_names) - 1):
        builder.add_edge(node_names[i], node_names[i + 1])
    builder.add_edge(node_names[-1], END)

    return builder.compile()
