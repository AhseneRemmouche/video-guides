"""Lab 13: pause for a human before a write action, go back in time, and stream."""
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode
from langgraph.types import Command, interrupt

from harbor.catalog import ALL_TOOLS
from harbor.agent_graph import SYSTEM
from harbor.config import get_model

model = get_model().bind_tools(ALL_TOOLS)


def call_model(state: MessagesState):
    return {"messages": [model.invoke([SYSTEM] + state["messages"])]}


def approve(state: MessagesState):
    """Pause before any place_hold call and ask a librarian. Other tools run without asking."""
    last = state["messages"][-1]
    holds = [c for c in last.tool_calls if c["name"] == "place_hold"]
    if holds:
        decision = interrupt({"question": "Approve this hold?", "calls": holds})
        if decision != "yes":
            refused = AIMessage("A librarian did not approve this hold, so I did not place it.")
            return Command(goto=END, update={"messages": [refused]})
    return Command(goto="tools")


def route(state: MessagesState):
    return "approve" if state["messages"][-1].tool_calls else END


builder = StateGraph(MessagesState)
builder.add_node("model", call_model)
builder.add_node("approve", approve)
builder.add_node("tools", ToolNode(ALL_TOOLS))
builder.add_edge(START, "model")
builder.add_conditional_edges("model", route, ["approve", END])
builder.add_edge("tools", "model")
graph = builder.compile(checkpointer=InMemorySaver())

# 1. Human in the loop: the run stops at interrupt() and waits.
config = {"configurable": {"thread_id": "hold-1"}}
request = "I'm member M-1002. Please place a hold on item B003 for me."
result = graph.invoke({"messages": [("user", request)]}, config)
print("1) Paused:", "__interrupt__" in result)
if "__interrupt__" in result:
    print("   waiting for:", result["__interrupt__"][0].value)
    print("   next node:", graph.get_state(config).next)
    result = graph.invoke(Command(resume="yes"), config)  # the librarian approves
    print("   after 'yes':", result["messages"][-1].content)

# 2. The same request, refused.
config2 = {"configurable": {"thread_id": "hold-2"}}
result = graph.invoke({"messages": [("user", request)]}, config2)
if "__interrupt__" in result:
    print("   after 'no': ", graph.invoke(Command(resume="no"), config2)["messages"][-1].content)

# 3. Time travel: list the checkpoints of thread hold-1 and replay from an earlier one with a changed message.
history = list(graph.get_state_history(config))
print(f"\n3) Thread hold-1 has {len(history)} checkpoints (newest first):")
for snap in history:
    print(f"   step {snap.metadata['step']:>2}  next={snap.next}  messages={len(snap.values.get('messages', []))}")
first_input = next(s for s in history if s.next == ("model",) and len(s.values["messages"]) == 1)
original = first_input.values["messages"][0]
# Reusing the message id REPLACES that message; a message without its id would be appended instead.
edited = HumanMessage("I'm member M-1002. Is item B006 available?", id=original.id)
fork = graph.update_state(first_input.config, {"messages": [edited]})
replayed = graph.invoke(None, fork)
print("   forked run answered:", replayed["messages"][-1].content)
print(f"   the thread now has {len(list(graph.get_state_history(config)))} checkpoints; the old branch is still there")

# 4. Streaming: 'messages' mode yields the model's tokens as they are generated.
print("\n4) stream_mode='messages': ", end="")
for token, meta in graph.stream({"messages": [("user", "In one sentence, what can I do at the maker space?")]},
                                {"configurable": {"thread_id": "stream"}}, stream_mode="messages"):
    if meta["langgraph_node"] == "model" and token.content:
        print(token.content, end="", flush=True)
print()
