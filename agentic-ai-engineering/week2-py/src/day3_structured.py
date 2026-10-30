"""
Day 3 (Lab 3): structured output with `output_type=<Pydantic model>`.

The SDK asks the model for JSON matching the schema and parses it into the model.
Small local models sometimes emit JSON that doesn't validate; if the first run
fails we RETRY ONCE with a simpler prompt and SAY SO in the output.
"""

import asyncio

from pydantic import BaseModel, Field
from agents import Agent, Runner

from ollama_setup import make_model, MODEL_NAME


class ColdEmail(BaseModel):
    subject: str = Field(description="A short, catchy subject line.")
    body: str = Field(description="The body of the cold email, 2-3 sentences.")
    tone: str = Field(description="One word describing the tone, e.g. 'professional'.")


agent = Agent(
    name="Structured Email Writer",
    instructions=(
        "You write cold sales emails for ComplAI, a SOC2 compliance SaaS. "
        "Return a subject, a 2-3 sentence body, and a one-word tone."
    ),
    output_type=ColdEmail,
    model=make_model(),
)


async def try_once(prompt: str):
    result = await Runner.run(agent, prompt)
    return result.final_output_as(ColdEmail)


async def main() -> None:
    print(f"=== Day 3: structured output / output_type (model={MODEL_NAME} on Ollama) ===\n")

    prompt = "Write a cold sales email to the CEO of a mid-size fintech company."
    try:
        email = await try_once(prompt)
    except Exception as first_err:
        print(f"[retry] First attempt failed to produce valid structured output: "
              f"{type(first_err).__name__}: {first_err}")
        print("[retry] Retrying ONCE with a simpler prompt...\n")
        simple_prompt = "Write a one-line cold email. Keep it very short."
        email = await try_once(simple_prompt)

    print("Parsed Pydantic object:\n")
    print(repr(email))
    print("\nFields:")
    print(f"  subject: {email.subject}")
    print(f"  body:    {email.body}")
    print(f"  tone:    {email.tone}")


if __name__ == "__main__":
    asyncio.run(main())
