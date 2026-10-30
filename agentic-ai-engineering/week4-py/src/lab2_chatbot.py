"""Lab 2 - a chatbot as a LangGraph StateGraph (wired to local Ollama).

This mirrors 2_lab2.py from the course, minus the Serper/Pushover tools and the
Gradio UI. It shows the five steps the course repeats for every graph:

  1. Define the State (a typed dict with a `messages` field).
  2. Start a StateGraph with that State.
  3. Add a node - a function that reads the state and returns an update.
  4. Add edges - START -> chatbot -> END.
  5. Compile the graph, then invoke it.

The key idea is the `add_messages` reducer on `messages`: when a node returns
`{"messages": [...]}`, LangGraph APPENDS those messages to the list instead of
replacing it. That is how the running conversation is accumulated in state.

Run it:  uv run python src/lab2_chatbot.py
"""

from typing import Annotated

from langgraph.graph import START, StateGraph
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict

from common import make_llm


# Step 1: the State object. `messages` uses the add_messages reducer, so updates
# are appended to the conversation rather than overwriting it.
class State(TypedDict):
    messages: Annotated[list, add_messages]


# Step 2: start the graph builder with this State class.
graph_builder = StateGraph(State)

# The model that powers the single node.
llm = make_llm()


# Step 3: the node. It reads the messages so far, asks the LLM, and returns the
# reply. Because of the reducer, returning {"messages": [response]} appends it.
def chatbot(state: State) -> dict:
    return {"messages": [llm.invoke(state["messages"])]}


graph_builder.add_node("chatbot", chatbot)

# Step 4: edges. START -> chatbot, and (by adding no edge out) chatbot is a leaf,
# so the graph ends after it. We add the START edge explicitly.
graph_builder.add_edge(START, "chatbot")

# Step 5: compile. The result is a runnable graph you invoke like any function.
graph = graph_builder.compile()


def chat_once(user_input: str) -> str:
    """Invoke the graph with one user message and return the assistant's reply."""
    result = graph.invoke({"messages": [{"role": "user", "content": user_input}]})
    return result["messages"][-1].content


if __name__ == "__main__":
    print("=== Lab 2: chatbot StateGraph (Ollama) ===\n")

    # Show the compiled graph's structure as a Mermaid diagram (text).
    print("Graph structure:")
    print(graph.get_graph().draw_mermaid())
    print()

    # Note: this graph has no checkpointer, so each invoke is independent - the
    # chatbot does NOT remember the previous turn. Memory is added in lab 3.
    for prompt in [
        "In one sentence, what is LangGraph?",
        "Name one benefit of modelling an agent as a graph. One sentence.",
    ]:
        print(f"User: {prompt}")
        print(f"Assistant: {chat_once(prompt)}\n")
