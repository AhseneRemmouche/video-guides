"""
Week 5 - Lab 1: AutoGen AgentChat basics, run against local Ollama.

Adapted from the course lab `1_lab1_autogen_agentchat.py`. The course notebook
uses top-level `await` and an OpenAI client; here everything runs inside
`asyncio.run(main())` and talks to a LOCAL Ollama model (free, no API key) via
`OllamaChatCompletionClient` -- which the course code itself already shows
alongside the OpenAI client.

Two parts:
  1. A plain AssistantAgent answering a one-off message.
  2. A "smart" AssistantAgent given a Python-function tool (`get_city_price`)
     that reads a tiny SQLite database of round-trip prices.

NOTE (honest): llama3.2 is a small (3.2B) model. It calls tools
inconsistently -- sometimes it invokes `get_city_price`, sometimes it just
narrates an answer without calling the tool. The script prints whether any
tool call actually happened so you can see what the model did on this run.
"""

import _ssl_localhost_patch  # noqa: F401  (must be first; local-OpenSSL workaround -- see module docstring)

import asyncio
import os
import sqlite3

from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.messages import TextMessage, ToolCallRequestEvent, ToolCallExecutionEvent
from autogen_core import CancellationToken
from autogen_ext.models.ollama import OllamaChatCompletionClient

MODEL = "llama3.2"
DB_PATH = os.path.join(os.path.dirname(__file__), "tickets.db")


def build_ticket_db() -> None:
    """Create and populate a tiny SQLite table of round-trip prices."""
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("CREATE TABLE cities (city_name TEXT PRIMARY KEY, round_trip_price REAL)")
    conn.commit()
    conn.close()
    for city, price in [
        ("London", 299), ("Paris", 399), ("Rome", 499),
        ("Madrid", 550), ("Barcelona", 580), ("Berlin", 525),
    ]:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute(
            "REPLACE INTO cities (city_name, round_trip_price) VALUES (?, ?)",
            (city.lower(), price),
        )
        conn.commit()
        conn.close()


def get_city_price(city_name: str) -> float | None:
    """Get the round-trip ticket price to travel to the city."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT round_trip_price FROM cities WHERE city_name = ?", (city_name.lower(),))
    result = c.fetchone()
    conn.close()
    return result[0] if result else None


async def main() -> None:
    model_client = OllamaChatCompletionClient(model=MODEL)
    print(f"== Using local Ollama model: {MODEL} ==\n")

    # ---- Part 1: a plain AssistantAgent ----------------------------------
    message = TextMessage(content="I'd like to go to London", source="user")

    agent = AssistantAgent(
        name="airline_agent",
        model_client=model_client,
        system_message="You are a helpful assistant for an airline. You give short, humorous answers.",
    )
    response = await agent.on_messages([message], cancellation_token=CancellationToken())
    print("--- Part 1: plain agent ---")
    print(response.chat_message.content)
    print()

    # ---- Part 2: an AssistantAgent with a tool ---------------------------
    build_ticket_db()
    print(f"(sanity check) get_city_price('Rome') = {get_city_price('Rome')}\n")

    smart_agent = AssistantAgent(
        name="smart_airline_agent",
        model_client=model_client,
        system_message=(
            "You are a helpful assistant for an airline. You give short, humorous answers, "
            "including the price of a round-trip ticket. Always use the get_city_price tool "
            "to look up the price."
        ),
        tools=[get_city_price],
        reflect_on_tool_use=True,
    )

    response = await smart_agent.on_messages([message], cancellation_token=CancellationToken())

    tool_called = False
    print("--- Part 2: tool-using agent (inner events) ---")
    for inner in response.inner_messages or []:
        if isinstance(inner, (ToolCallRequestEvent, ToolCallExecutionEvent)):
            tool_called = True
        print(f"[{type(inner).__name__}] {inner.content}")
    print()
    print("--- Part 2: final answer ---")
    print(response.chat_message.content)
    print()
    print(f">> Did the model actually invoke the get_city_price tool this run? {tool_called}")
    if not tool_called:
        print(">> (Honest caveat: the small model answered without calling the tool this time.)")

    await model_client.close()


if __name__ == "__main__":
    asyncio.run(main())
