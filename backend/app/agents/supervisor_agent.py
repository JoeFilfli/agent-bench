import operator
from typing import Annotated, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

from app.tools.registry import get_tools


class SupervisorState(TypedDict):
    messages: Annotated[list, add_messages]
    task: str
    output: str
    reasoning_steps: Annotated[list, operator.add]
    tool_calls: list
    worker_results: Annotated[dict, operator.or_]


def build_supervisor(config: dict):
    orch_cfg = config.get("orchestrator", {})
    workers_cfg = config.get("workers", [])

    orch_model = ChatOpenAI(
        model=orch_cfg.get("model", "gpt-4o"),
        temperature=orch_cfg.get("temperature", 0.0),
    )
    orch_prompt = orch_cfg.get("system_prompt", "Break the task down and delegate to workers. Then synthesize a final answer.")

    worker_models = {}
    for w in workers_cfg:
        role = w.get("role")
        model = ChatOpenAI(model=w.get("model", "gpt-4o-mini"), temperature=w.get("temperature", 0.0))
        tools = get_tools(w.get("tools", []))
        if tools:
            model = model.bind_tools(tools)
        worker_models[role] = (model, w.get("system_prompt", f"You are the {role} worker."))

    async def orchestrator_node(state: SupervisorState) -> dict:
        worker_list = ", ".join(worker_models.keys())
        sys = f"{orch_prompt}\n\nAvailable workers: {worker_list}. Call each worker by name in your reasoning."
        msgs = [SystemMessage(content=sys)] + list(state["messages"])
        response = await orch_model.ainvoke(msgs)
        steps = state.get("reasoning_steps", [])
        steps.append({"role": "orchestrator", "content": response.content})
        return {
            "messages": [response],
            "reasoning_steps": steps,
        }

    def make_worker_node(role: str):
        model, sys_prompt = worker_models[role]

        async def worker_node(state: SupervisorState) -> dict:
            msgs = [SystemMessage(content=sys_prompt)] + list(state["messages"])
            response = await model.ainvoke(msgs)
            tagged = response.model_copy(update={"content": f"[{role}]: {response.content}"})
            return {
                "messages": [tagged],
                "worker_results": {role: response.content},
                "reasoning_steps": [{"role": role, "content": response.content}],
            }

        worker_node.__name__ = role
        return worker_node

    async def synthesizer_node(state: SupervisorState) -> dict:
        results = state.get("worker_results", {})
        summary = "\n\n".join(f"{k}: {v}" for k, v in results.items())
        msgs = [
            SystemMessage(content="Synthesize the worker results into a single final answer."),
            HumanMessage(content=f"Task: {state['task']}\n\nWorker results:\n{summary}"),
        ]
        response = await orch_model.ainvoke(msgs)
        return {"output": response.content, "messages": [response]}

    builder = StateGraph(SupervisorState)
    builder.add_node("orchestrator", orchestrator_node)
    for role in worker_models:
        builder.add_node(role, make_worker_node(role))
    builder.add_node("synthesizer", synthesizer_node)

    builder.set_entry_point("orchestrator")
    for role in worker_models:
        builder.add_edge("orchestrator", role)
        builder.add_edge(role, "synthesizer")
    builder.add_edge("synthesizer", END)

    return builder.compile()
