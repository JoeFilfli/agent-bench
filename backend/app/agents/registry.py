from app.agents.debate_agent import build_debate
from app.agents.pipeline_agent import build_pipeline
from app.agents.react_agent import build_react_agent
from app.agents.supervisor_agent import build_supervisor


def get_agent(graph_config: dict):
    t = graph_config.get("type", "react")
    if t == "react":
        return build_react_agent(graph_config)
    if t == "pipeline":
        return build_pipeline(graph_config)
    if t == "debate":
        return build_debate(graph_config)
    if t == "supervisor":
        return build_supervisor(graph_config)
    raise ValueError(f"Unknown agent type: {t!r}. Must be one of: react, pipeline, debate, supervisor")
