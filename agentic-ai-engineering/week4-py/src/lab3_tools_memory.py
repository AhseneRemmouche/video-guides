"""Lab 3 - tools + conditional edges + memory (wired to local Ollama).

This mirrors 3_lab3.py, but swaps the course's Playwright browser tools (which need
a real browser) for two small, safe, local tools so the whole thing runs offline:

  * calculator(expression)  - evaluate a simple arithmetic expression.
  * get_price(symbol)       - a FAKE price lookup (no network), so you can see a
                              tool being chosen and called without any API key.

Three new ideas from the course appear here:

  * bind_tools  - the LLM is told which tools exist and may ask to call one.
  * ToolNode + tools_condition - a prebuilt node that runs whatever tool the LLM
    asked for, and a prebuilt router that sends the graph to "tools" when there is
    a tool call, or to END when there is not.
  * a checkpointer (MemorySaver or SqliteSaver) + a thread_id - so the graph
    REMEMBERS the conversation between separate invoke() calls. Same thread_id =
    same memory.

The conditional edge loops: chatbot -> (tools?) -> chatbot -> ... until the LLM
produces a plain answer with no tool call.

Run it:  uv run python src/lab3_tools_memory.py
   SQLite checkpointer instead of in-memory:  CHECKPOINTER=sqlite uv run python src/lab3_tools_memory.py
"""

import os
from typing import Annotated

from langchain_core.tools import tool
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from typing_extensions import TypedDict

from common import make_llm


# --- State (same shape as lab 2) -------------------------------------------
class State(TypedDict):
    messages: Annotated[list, add_messages]


# --- Tools -----------------------------------------------------------------
# The @tool decorator turns a plain function into a LangChain tool: its name,
# docstring and type hints become the schema the LLM sees. The docstring matters
# a lot - it is how the model decides when to call the tool.
@tool
def calculator(expression: str) -> str:
    """Evaluate a basic arithmetic expression, e.g. '23 * 19' or '(2+3)/4'.

    Only numbers and + - * / ( ) . are allowed."""
    allowed = set("0123456789+-*/(). ")
    if not set(expression) <= allowed:
        return "Error: only numbers and + - * / ( ) are allowed."
    try:
        # eval is safe here because we restricted the characters above and pass
        # no names. A real app would use a proper expression parser.
        return str(eval(expression, {"__builtins__": {}}, {}))
    except Exception as exc:  # noqa: BLE001 - surface the error to the model
        return f"Error: {exc}"


@tool
def get_price(symbol: str) -> str:
    """Return the current price for a stock ticker symbol (FAKE demo data)."""
    fake_prices = {"AAPL": 231.4, "MSFT": 418.2, "GOOG": 165.7, "NVDA": 142.9}
    price = fake_prices.get(symbol.upper())
    if price is None:
        return f"No price on file for {symbol!r}. Known: {', '.join(fake_prices)}."
    return f"{symbol.upper()} is trading at ${price:.2f}."


tools = [calculator, get_price]


# --- The graph -------------------------------------------------------------
llm = make_llm()
llm_with_tools = llm.bind_tools(tools)


def chatbot(state: State) -> dict:
    return {"messages": [llm_with_tools.invoke(state["messages"])]}


def build_graph():
    graph_builder = StateGraph(State)
    graph_builder.add_node("chatbot", chatbot)
    graph_builder.add_node("tools", ToolNode(tools=tools))

    # tools_condition inspects the last message: if the LLM asked for a tool it
    # routes to "tools", otherwise it routes to END.
    graph_builder.add_conditional_edges("chatbot", tools_condition)
    # After the tools run, go back to the chatbot so it can use the results.
    graph_builder.add_edge("tools", "chatbot")
    graph_builder.add_edge(START, "chatbot")

    # Pick the checkpointer. Both persist state per thread_id; SqliteSaver also
    # writes to a file so memory survives a restart.
    if os.getenv("CHECKPOINTER") == "sqlite":
        import sqlite3

        from langgraph.checkpoint.sqlite import SqliteSaver

        conn = sqlite3.connect("memory.db", check_same_thread=False)
        checkpointer = SqliteSaver(conn)
        print("[checkpointer] SqliteSaver -> memory.db")
    else:
        checkpointer = MemorySaver()
        print("[checkpointer] MemorySaver (in-process)")

    return graph_builder.compile(checkpointer=checkpointer)


graph = build_graph()


def send(user_input: str, thread_id: str) -> str:
    """Send one message on a given conversation thread and return the reply."""
    config = {"configurable": {"thread_id": thread_id}}
    result = graph.invoke(
        {"messages": [{"role": "user", "content": user_input}]}, config=config
    )
    return result["messages"][-1].content


if __name__ == "__main__":
    print("=== Lab 3: tools + conditional edges + memory (Ollama) ===\n")
    print("Graph structure:")
    print(graph.get_graph().draw_mermaid())
    print()

    thread = "demo-thread-1"

    # Turn 1: give the model a fact AND ask it to use a tool.
    q1 = "My name is Ada. Please use the calculator to compute 23 * 19."
    print(f"[thread={thread}] User: {q1}")
    print(f"Assistant: {send(q1, thread)}\n")

    # Turn 2: SAME thread_id. If memory works, the model knows the name from
    # turn 1 even though we send only this new message.
    q2 = "What is my name, and what was the multiplication result you gave me?"
    print(f"[thread={thread}] User: {q2}")
    print(f"Assistant: {send(q2, thread)}\n")

    # Turn 3: a different thread has NO memory of Ada - proves isolation.
    other = "demo-thread-2"
    q3 = "What is my name?"
    print(f"[thread={other}] User: {q3}")
    print(f"Assistant: {send(q3, other)}\n")

    # Peek at what the checkpointer stored for the first thread.
    state = graph.get_state({"configurable": {"thread_id": thread}})
    print(f"[checkpoint] thread {thread!r} holds {len(state.values['messages'])} messages.")
