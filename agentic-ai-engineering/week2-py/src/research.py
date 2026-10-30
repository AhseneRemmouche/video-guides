"""
Day 4 (Lab 4): a small deep-research team.

  planner  -> structured list of search terms (output_type=WebSearchPlan)
  search   -> a CANNED @function_tool (NO network, NO hosted WebSearchTool)
  writer   -> turns the canned findings into a short markdown report
  manager  -> orchestrates the three

IMPORTANT HONESTY NOTE: Ed Donner's course uses the OpenAI-hosted `WebSearchTool`,
which only works on OpenAI's platform. We REPLACE it with a canned function tool
that returns fixed, made-up text. So this proves the orchestration/SDK plumbing
runs locally; it does NOT actually search the web.
"""

import asyncio

from pydantic import BaseModel, Field
from agents import Agent, Runner, function_tool

from ollama_setup import make_model, MODEL_NAME


# ---- CANNED "search" (replaces the OpenAI-only hosted WebSearchTool) ----
CANNED_FACTS = {
    "default": (
        "- OpenAI Agents SDK (2025): lightweight Python SDK with Agents, Runner, "
        "function tools, handoffs, guardrails, and hosted tracing.\n"
        "- LangGraph: graph-based orchestration for stateful multi-agent apps.\n"
        "- CrewAI: role-based 'crew' of agents collaborating on tasks.\n"
        "- AutoGen (Microsoft): conversational multi-agent framework."
    ),
}


@function_tool
def canned_search(term: str) -> str:
    """Return fixed, pre-written notes for a search term (NO real web access)."""
    return CANNED_FACTS["default"]


# ---- planner: structured output ----
class WebSearchItem(BaseModel):
    reason: str = Field(description="Why this search helps answer the query.")
    query: str = Field(description="The search term to use.")


class WebSearchPlan(BaseModel):
    searches: list[WebSearchItem] = Field(description="The searches to perform.")


planner_agent = Agent(
    name="PlannerAgent",
    instructions=(
        "You are a research planner. Given a query, output exactly 2 web searches "
        "that would help answer it."
    ),
    model=make_model(),
    output_type=WebSearchPlan,
)

# ---- search agent: must call the canned tool ----
search_agent = Agent(
    name="Search agent",
    instructions=(
        "Given a search term, call the canned_search tool and return a 1-2 sentence "
        "summary of what it returns. No extra commentary."
    ),
    tools=[canned_search],
    model=make_model(),
)

# ---- writer: short report ----
writer_agent = Agent(
    name="WriterAgent",
    instructions=(
        "You are a senior researcher. Given the original query and some research notes, "
        "write a SHORT markdown report (a title, 2 short paragraphs, max ~150 words)."
    ),
    model=make_model(),
)


class ResearchManager:
    async def plan(self, query: str) -> WebSearchPlan:
        print("Planning searches...")
        result = await Runner.run(planner_agent, f"Query: {query}")
        plan = result.final_output_as(WebSearchPlan)
        print(f"Planned {len(plan.searches)} searches")
        return plan

    async def search_one(self, item: WebSearchItem) -> str:
        inp = f"Search term: {item.query}\nReason: {item.reason}"
        result = await Runner.run(search_agent, inp, max_turns=6)
        return str(result.final_output)

    async def search_all(self, plan: WebSearchPlan) -> list[str]:
        print("Searching (canned)...")
        tasks = [asyncio.create_task(self.search_one(i)) for i in plan.searches]
        results = []
        for t in asyncio.as_completed(tasks):
            try:
                results.append(await t)
            except Exception as e:  # keep the team resilient to one bad search
                print(f"  (a search failed: {type(e).__name__})")
        return results

    async def write(self, query: str, findings: list[str]) -> str:
        print("Writing report...")
        inp = f"Original query: {query}\nResearch notes: {findings}"
        result = await Runner.run(writer_agent, inp)
        return str(result.final_output)

    async def run(self, query: str) -> str:
        plan = await self.plan(query)
        findings = await self.search_all(plan)
        if not findings:
            # fall back to the canned facts directly if every search failed
            findings = [CANNED_FACTS["default"]]
        return await self.write(query, findings)


async def main() -> None:
    print(f"=== Day 4: deep-research team, CANNED search (model={MODEL_NAME} on Ollama) ===\n")
    query = "Latest AI agent frameworks in 2025"
    report = await ResearchManager().run(query)
    print("\n--- Short report ---\n")
    print(report)


if __name__ == "__main__":
    asyncio.run(main())
