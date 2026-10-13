"""Lab 14: the same agent in a few lines with create_agent, plus a typed final answer and per-user context."""
from dataclasses import dataclass

from langchain.agents import create_agent
from langchain.agents.structured_output import ProviderStrategy, ToolStrategy
from langchain.tools import ToolRuntime, tool
from langgraph.checkpoint.memory import InMemorySaver
from pydantic import BaseModel

from harbor.catalog import MEMBERS, check_availability, search_catalog
from harbor.config import get_model


@dataclass
class Visitor:
    member_id: str  # set by the application after login, never by the model


@tool
def my_account(runtime: ToolRuntime[Visitor]) -> str:
    """Show the logged-in member's own loans, holds and fees."""
    m = MEMBERS[runtime.context.member_id]  # the id comes from the app's context, so no one can ask for another member
    return f"{m['name']}: loans {m['loans']}, holds {m['holds']}, fees {m['fees_eur']:.2f} EUR"


agent = create_agent(
    model=get_model(),
    tools=[search_catalog, check_availability, my_account],
    system_prompt="You are Harbor City Library's assistant. Use the tools. Answer briefly.",
    context_schema=Visitor,
    checkpointer=InMemorySaver(),
)

print("1) Graph nodes create_agent built:", list(agent.get_graph().nodes))

config = {"configurable": {"thread_id": "sam"}}
for text in ["What do I owe, and what do I have on loan?", "Is The Little Crab Who Could on the shelf?"]:
    result = agent.invoke({"messages": [("user", text)]}, config, context=Visitor(member_id="M-1002"))
    calls = [(c["name"], c["args"]) for m in result["messages"] if m.type == "ai" for c in m.tool_calls]
    print(f"\n2) Q: {text}\n   tools: {calls[-2:]}\n   A: {result['messages'][-1].content}")


# 3. response_format: the agent's last step returns a validated object instead of free text.
class Availability(BaseModel):
    title: str
    copies_available: int
    branch: str


print("\n3) response_format, two strategies:")
for label, strategy in [("ToolStrategy", ToolStrategy(Availability)), ("ProviderStrategy", ProviderStrategy(Availability))]:
    typed = create_agent(get_model(), [search_catalog, check_availability], response_format=strategy,
                         system_prompt="Find the item with search_catalog, then check_availability.")
    result = typed.invoke({"messages": [("user", "Is 'Build Your Own Radio' available?")]})
    used = [c["name"] for m in result["messages"] if m.type == "ai" for c in m.tool_calls]
    print(f"   {label:<17} tools called: {used}\n   {'':<17} structured_response: {result.get('structured_response')!r}")
