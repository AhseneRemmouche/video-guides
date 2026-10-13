"""The library agent as a LangGraph graph (the loop from lab 09), reused by labs 11-13."""
from langchain_core.messages import SystemMessage
from langgraph.graph import START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition

from harbor.catalog import READ_TOOLS
from harbor.config import get_model

SYSTEM = SystemMessage("You are Harbor City Library's assistant. Use the tools to look things up. "
                       "Remember what the visitor told you earlier in the conversation. Answer briefly.")


def build_builder(tools=READ_TOOLS):
    model = get_model().bind_tools(tools)

    def call_model(state: MessagesState):
        return {"messages": [model.invoke([SYSTEM] + state["messages"])]}

    builder = StateGraph(MessagesState)
    builder.add_node("model", call_model)
    builder.add_node("tools", ToolNode(tools))
    builder.add_edge(START, "model")
    builder.add_conditional_edges("model", tools_condition)
    builder.add_edge("tools", "model")
    return builder
