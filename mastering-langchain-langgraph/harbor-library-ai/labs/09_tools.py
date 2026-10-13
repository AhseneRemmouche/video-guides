"""Lab 09: tools. First by hand, then with LangGraph's ToolNode in a loop."""
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition

from harbor.catalog import READ_TOOLS, check_availability
from harbor.config import get_model

# 1. A tool is a function plus a name, a description and an argument schema the model reads.
print("1) What the model sees for check_availability:")
print("  ", check_availability.name, "|", check_availability.description)
print("  ", check_availability.args)

# 2. bind_tools: the model can now answer with tool calls instead of text. It does not run them.
model = get_model().bind_tools(READ_TOOLS)
reply = model.invoke("Is The Quiet Engine on the shelf? Its id is B004.")
print("\n2) The model asked for:", reply.tool_calls)

# 3. We run the tool ourselves and could send the result back. ToolNode automates exactly this.
for call in reply.tool_calls:
    print("   running it gives:", check_availability.invoke(call["args"]))

# 4. The agent loop as a graph: model -> (tools -> model)* -> end.
SYSTEM = SystemMessage("You are Harbor City Library's assistant. Use the tools to look things up. Answer briefly.")


def call_model(state: MessagesState):
    return {"messages": [model.invoke([SYSTEM] + state["messages"])]}


builder = StateGraph(MessagesState)
builder.add_node("model", call_model)
builder.add_node("tools", ToolNode(READ_TOOLS))
builder.add_edge(START, "model")
builder.add_conditional_edges("model", tools_condition)  # goes to "tools" if there are tool calls, else ends
builder.add_edge("tools", "model")
agent = builder.compile()

for question in ["Do you have any books by Mara Quint? Is one available?",
                 "What are member M-1001's loans and fees?"]:
    print(f"\n4) Q: {question}")
    result = agent.invoke({"messages": [HumanMessage(question)]})
    for m in result["messages"][1:]:
        if m.type == "ai" and m.tool_calls:
            print("   model -> tools:", [(c["name"], c["args"]) for c in m.tool_calls])
        elif m.type == "tool":
            print(f"   tool {m.name} -> {m.content[:100]!r}")
        else:
            print("   answer:", m.content)
