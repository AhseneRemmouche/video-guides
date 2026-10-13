"""Lab 15: middleware: hooks that run around every model and tool call of a create_agent agent."""
from langchain.agents import create_agent
from langchain.agents.middleware import (HumanInTheLoopMiddleware, ModelCallLimitMiddleware, PIIMiddleware,
                                         before_model)
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

from harbor.catalog import ALL_TOOLS
from harbor.config import get_model


@before_model
def log_calls(state, runtime):
    """A custom hook: print what the model is about to see. Returning None changes nothing."""
    last = state["messages"][-1]
    print(f"      [before_model] {len(state['messages'])} messages, last from {last.type}: {str(last.content)[:60]!r}")
    return None


agent = create_agent(
    get_model(),
    ALL_TOOLS,
    system_prompt="You are Harbor City Library's assistant. Use the tools. Answer briefly.",
    middleware=[
        log_calls,
        PIIMiddleware("email", strategy="redact"),                    # emails never reach the model
        ModelCallLimitMiddleware(run_limit=4, exit_behavior="end"),   # stop runaway loops
        HumanInTheLoopMiddleware(interrupt_on={"place_hold": True}),  # a person approves every hold
    ],
    checkpointer=InMemorySaver(),
)

print("1) PII redaction + logging:")
r = agent.invoke({"messages": [("user", "My email is sam.okoro@example.com. Is item B006 available?")]},
                 {"configurable": {"thread_id": "a"}})
print("   the model saw:", repr(r["messages"][0].content))
print("   answer:", r["messages"][-1].content)

print("\n2) Human in the loop for place_hold:")
config = {"configurable": {"thread_id": "b"}}
r = agent.invoke({"messages": [("user", "I'm member M-1002, please place a hold on B010.")]}, config)
if "__interrupt__" in r:
    request = r["__interrupt__"][0].value
    print("   paused for review:", [(a["name"], a["args"]) for a in request["action_requests"]])
    r = agent.invoke(Command(resume={"decisions": [{"type": "reject", "message": "Holds on B010 are paused this week."}]}),
                     config)
print("   after the decision:", r["messages"][-1].content)
