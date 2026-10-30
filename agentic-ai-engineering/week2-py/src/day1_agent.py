"""
Day 1 (Lab 1): your first Agent + Runner.run.

Course original used `Agent(..., model="gpt-4o-mini")` on OpenAI. Here the same
code runs against local Ollama via the shared `make_model()` helper.
"""

import asyncio

from agents import Agent, Runner

from ollama_setup import make_model, MODEL_NAME


async def main() -> None:
    agent = Agent(
        name="Jokester",
        instructions="You are a joke teller. Tell one short, clean joke.",
        model=make_model(),
    )

    result = await Runner.run(agent, "Tell a joke about Autonomous AI Agents")

    print(f"=== Day 1: first Agent (model={MODEL_NAME} on Ollama) ===\n")
    print(result.final_output)


if __name__ == "__main__":
    asyncio.run(main())
