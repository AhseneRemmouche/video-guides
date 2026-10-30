"""Day 1 - a tiny 'plan then act' workflow against a LOCAL Ollama model.

Step 1: ask the model to produce a short numbered plan.
Step 2: feed that plan back and ask it to execute the plan into a final answer.

Course parallel: lab1 (1_lab1.py) chains two LLM calls. Here we run it locally
and free against Ollama's OpenAI-compatible endpoint instead of paid GPT models.
"""

import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(override=True)

BASE_URL = os.getenv("OPENAI_BASE_URL", "http://localhost:11434/v1")
API_KEY = os.getenv("OPENAI_API_KEY", "ollama")
MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

client = OpenAI(base_url=BASE_URL, api_key=API_KEY)


def ask(messages, max_tokens=150):
    resp = client.chat.completions.create(
        model=MODEL, messages=messages, max_tokens=max_tokens, temperature=0.4
    )
    return resp.choices[0].message.content.strip()


def main():
    goal = "Plan a simple weekend to learn the basics of Python."

    print("=" * 60)
    print(f"MODEL: {MODEL}  (local Ollama, no paid key)")
    print(f"GOAL : {goal}")
    print("=" * 60)

    # STEP 1: PLAN
    plan_prompt = [
        {"role": "system", "content": "You are a concise planner. Reply with a short numbered plan of at most 3 steps. No preamble."},
        {"role": "user", "content": goal},
    ]
    plan = ask(plan_prompt)
    print("\n[STEP 1 - PLAN]\n")
    print(plan)

    # STEP 2: ACT - feed the plan back in and execute it.
    act_prompt = [
        {"role": "system", "content": "You execute a plan. For each step, write one concrete, actionable sentence. Be brief."},
        {"role": "user", "content": f"Goal: {goal}\n\nPlan:\n{plan}\n\nNow carry out the plan."},
    ]
    result = ask(act_prompt)
    print("\n[STEP 2 - ACT]\n")
    print(result)
    print("\n[DONE]")


if __name__ == "__main__":
    main()
