"""
Day 2 (Lab 2): the three SDK building blocks on one short task.

  1. @function_tool  - a Python function the model can call (here: a CANNED
     "send email" that just records the body instead of hitting SendGrid).
  2. agent-as-a-tool - two sales agents exposed via `.as_tool(...)`.
  3. handoff         - the Sales Manager hands the chosen email off to an
     Email Manager agent, which calls the send_email tool.

Course original used SendGrid + gpt-4o-mini. Here: no network email, local Ollama.
"""

import asyncio
from typing import Dict

from agents import Agent, Runner, function_tool

from ollama_setup import make_model, MODEL_NAME

# A place to capture what the "email" tool was asked to send, so we can prove it fired.
SENT_EMAILS: list[Dict[str, str]] = []


@function_tool
def send_email(body: str) -> Dict[str, str]:
    """Send a cold sales email with the given body to all sales prospects."""
    # CANNED: no SendGrid, no network. Just record it.
    SENT_EMAILS.append({"body": body})
    return {"status": "success"}


instructions1 = (
    "You are a professional, serious sales agent for ComplAI, a SaaS tool for SOC2 "
    "compliance. Write a SHORT professional cold email (3-4 sentences)."
)
instructions2 = (
    "You are a witty, humorous sales agent for ComplAI, a SaaS tool for SOC2 "
    "compliance. Write a SHORT funny cold email (3-4 sentences)."
)

sales_agent1 = Agent(name="Professional Sales Agent", instructions=instructions1, model=make_model())
sales_agent2 = Agent(name="Engaging Sales Agent", instructions=instructions2, model=make_model())

# agents-as-tools
description = "Write a cold sales email"
tool1 = sales_agent1.as_tool(tool_name="professional_email", tool_description=description)
tool2 = sales_agent2.as_tool(tool_name="witty_email", tool_description=description)

# The handoff target: an Email Manager that actually "sends".
emailer_agent = Agent(
    name="Email Manager",
    instructions=(
        "You receive the body of an email to send. Call the send_email tool exactly "
        "once with that body. Then reply 'Email sent.'"
    ),
    tools=[send_email],
    model=make_model(),
    handoff_description="Send the chosen cold email",
)

sales_manager = Agent(
    name="Sales Manager",
    instructions=(
        "You are a Sales Manager at ComplAI.\n"
        "1. Use the professional_email tool AND the witty_email tool to generate two drafts.\n"
        "2. Pick the single best one.\n"
        "3. Hand off that ONE winning draft to the 'Email Manager' to send it.\n"
        "Do not write the drafts yourself; use the tools."
    ),
    tools=[tool1, tool2],
    handoffs=[emailer_agent],
    model=make_model(),
)


async def main() -> None:
    print(f"=== Day 2: tools + agents-as-tools + handoff (model={MODEL_NAME} on Ollama) ===\n")
    message = "Send a cold sales email addressed to 'Dear CEO'"
    result = await Runner.run(sales_manager, message, max_turns=12)

    print("Final output from the agent chain:\n")
    print(result.final_output)
    print("\n--- Canned send_email tool captured ---")
    if SENT_EMAILS:
        for i, e in enumerate(SENT_EMAILS, 1):
            print(f"[email {i}] {e['body'][:400]}")
    else:
        print("(the small model did not complete the full tool->handoff->tool chain; "
              "see notes in README)")


if __name__ == "__main__":
    asyncio.run(main())
