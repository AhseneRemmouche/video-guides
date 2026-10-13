"""Lab 11: checkpointers give a graph a memory per conversation (thread) and let it survive restarts."""
import sqlite3

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.sqlite import SqliteSaver

from harbor.agent_graph import build_builder
from harbor.config import RUNS


def show(result, start):
    """Print the tool calls and the final answer of one turn (messages from index `start` on)."""
    for m in result["messages"][start:]:
        if m.type == "ai" and m.tool_calls:
            print("      tool call:", [(c["name"], c["args"]) for c in m.tool_calls])
    print(f"   -> {result['messages'][-1].content}")


def ask(graph, thread, text):
    config = {"configurable": {"thread_id": thread}}
    before = len(graph.get_state(config).values.get("messages", []))
    print(f"   [{thread}] {text}   ({before} earlier messages loaded)")
    show(graph.invoke({"messages": [("user", text)]}, config), before)


# 1. Without a checkpointer every call starts from zero.
plain = build_builder().compile()
print("1) No checkpointer:")
for text in ["Hi, I'm Lea, member M-1001.", "What is my member id?"]:
    print(f"   {text}")
    show(plain.invoke({"messages": [("user", text)]}), 0)

# 2. With a checkpointer, each thread_id keeps its own history.
graph = build_builder().compile(checkpointer=InMemorySaver())
print("\n2) InMemorySaver, two threads:")
ask(graph, "lea", "Hi, I'm Lea, member M-1001.")
ask(graph, "lea", "What is my member id?")
ask(graph, "sam", "What is my member id?")

# 3. The saved state: messages so far and the checkpoints that led there.
config = {"configurable": {"thread_id": "lea"}}
state = graph.get_state(config)
print(f"\n3) Thread 'lea' has {len(state.values['messages'])} messages and "
      f"{len(list(graph.get_state_history(config)))} checkpoints; next node: {state.next or 'none (finished)'}")

# 4. SqliteSaver writes checkpoints to a file, so a new process (or a restart) can continue the thread.
RUNS.mkdir(exist_ok=True)
db_path = RUNS / "checkpoints.sqlite"
db_path.unlink(missing_ok=True)
with sqlite3.connect(db_path, check_same_thread=False) as conn:
    durable = build_builder().compile(checkpointer=SqliteSaver(conn))
    print("\n4) SqliteSaver:")
    ask(durable, "ines", "Hello, I'm Ines, member M-1003. I love cooking books.")
with sqlite3.connect(db_path, check_same_thread=False) as conn:  # a fresh connection, as after a restart
    durable = build_builder().compile(checkpointer=SqliteSaver(conn))
    ask(durable, "ines", "Which genre do I like?")
    rows = conn.execute("SELECT COUNT(*) FROM checkpoints WHERE thread_id = 'ines'").fetchone()[0]
    print(f"   {rows} checkpoint rows stored for thread 'ines' in {db_path.name}")
