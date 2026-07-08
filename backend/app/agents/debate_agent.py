from typing import Annotated, TypedDict

from langchain_core.messages import AIMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages


class DebateState(TypedDict):
    messages: Annotated[list, add_messages]
    task: str
    output: str
    reasoning_steps: list
    tool_calls: list
    round: int


def build_debate(config: dict):
    rounds = config.get("rounds", 3)
    agents_cfg = config.get("agents", [])
    judge_cfg = config.get("judge", {})

    proposer_cfg = next((a for a in agents_cfg if a.get("role") == "proposer"), agents_cfg[0])
    opposer_cfg = next((a for a in agents_cfg if a.get("role") == "opposer"), agents_cfg[-1])

    proposer_model = ChatOpenAI(model=proposer_cfg.get("model", "gpt-4o"), temperature=proposer_cfg.get("temperature", 0.0))
    opposer_model = ChatOpenAI(model=opposer_cfg.get("model", "gpt-4o"), temperature=opposer_cfg.get("temperature", 0.0))
    judge_model = ChatOpenAI(model=judge_cfg.get("model", "gpt-4o"), temperature=judge_cfg.get("temperature", 0.0))

    judge_prompt = judge_cfg.get("system_prompt", "Pick the stronger argument and write a final answer.")

    async def proposer_node(state: DebateState) -> dict:
        sys = proposer_cfg.get("system_prompt", "Argue in favor of the best solution.")
        msgs = [SystemMessage(content=sys)] + list(state["messages"])
        response = await proposer_model.ainvoke(msgs)
        steps = state.get("reasoning_steps", [])
        steps.append({"role": "proposer", "round": state["round"], "content": response.content})
        tagged = response.model_copy(update={"content": f"[Proposer round {state['round']}]: {response.content}"})
        return {
            "messages": [tagged],
            "reasoning_steps": steps,
        }

    async def opposer_node(state: DebateState) -> dict:
        sys = opposer_cfg.get("system_prompt", "Find flaws and argue for an alternative.")
        msgs = [SystemMessage(content=sys)] + list(state["messages"])
        response = await opposer_model.ainvoke(msgs)
        steps = state.get("reasoning_steps", [])
        steps.append({"role": "opposer", "round": state["round"], "content": response.content})
        tagged = response.model_copy(update={"content": f"[Opposer round {state['round']}]: {response.content}"})
        return {
            "messages": [tagged],
            "round": state["round"] + 1,
            "reasoning_steps": steps,
        }

    async def judge_node(state: DebateState) -> dict:
        history = "\n\n".join(m.content for m in state["messages"] if isinstance(m, AIMessage))
        msgs = [
            SystemMessage(content=judge_prompt),
            *state["messages"],
            AIMessage(content=f"Debate history:\n{history}\n\nNow give the final answer."),
        ]
        response = await judge_model.ainvoke(msgs)
        return {"output": response.content, "messages": [response]}

    def should_continue(state: DebateState) -> str:
        if state["round"] > rounds:
            return "judge"
        return "proposer"

    builder = StateGraph(DebateState)
    builder.add_node("proposer", proposer_node)
    builder.add_node("opposer", opposer_node)
    builder.add_node("judge", judge_node)

    builder.set_entry_point("proposer")
    builder.add_edge("proposer", "opposer")
    builder.add_conditional_edges("opposer", should_continue, {"proposer": "proposer", "judge": "judge"})
    builder.add_edge("judge", END)

    return builder.compile()
