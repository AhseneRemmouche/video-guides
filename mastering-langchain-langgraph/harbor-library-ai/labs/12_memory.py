"""Lab 12: short-term memory (keep the conversation small) and long-term memory (facts across threads)."""
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, trim_messages
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import START, MessagesState, StateGraph
from langgraph.store.base import BaseStore
from langgraph.store.memory import InMemoryStore

from harbor.config import get_model

model = get_model()

# 1. Short-term: trim_messages keeps only the most recent part of a long conversation.
history = []
for i in range(1, 7):
    history += [HumanMessage(f"Question {i}: tell me about branch number {i}."), AIMessage(f"Answer {i}: ...")]
kept = trim_messages(history, max_tokens=40, token_counter="approximate", strategy="last", start_on="human")
print(f"1) trim_messages: {len(history)} messages -> {len(kept)} kept:", [m.content[:11] for m in kept])

# 2. Long-term: a store holds facts by namespace, shared by every thread of the same member.
store = InMemoryStore()


def call_model(state: MessagesState, config, *, store: BaseStore):
    member = config["configurable"]["member_id"]
    namespace = ("members", member, "preferences")
    last = state["messages"][-1].content
    if last.lower().startswith("remember"):  # a deliberately simple rule for what to save
        store.put(namespace, f"note-{len(store.search(namespace))}", {"text": last})
    notes = [item.value["text"] for item in store.search(namespace)]
    system = SystemMessage("You are Harbor City Library's assistant. Answer briefly. "
                           f"What this member asked you to remember: {notes or 'nothing yet'}")
    recent = trim_messages(state["messages"], max_tokens=500, token_counter="approximate", strategy="last",
                           start_on="human")
    return {"messages": [model.invoke([system] + recent)]}


builder = StateGraph(MessagesState)
builder.add_node("model", call_model)
builder.add_edge(START, "model")
graph = builder.compile(checkpointer=InMemorySaver(), store=store)


def ask(thread, text):
    config = {"configurable": {"thread_id": thread, "member_id": "M-1002"}}
    print(f"   [{thread}] {text}\n   -> {graph.invoke({'messages': [('user', text)]}, config)['messages'][-1].content}")


print("\n2) Long-term memory across two threads of member M-1002:")
ask("monday", "Remember: I only read books in large print.")
ask("friday", "Can you suggest how I should look for a new novel?")
print("   stored:", [i.value for i in store.search(("members", "M-1002", "preferences"))])
