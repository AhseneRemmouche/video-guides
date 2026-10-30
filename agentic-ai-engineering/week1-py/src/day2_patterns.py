"""Day 2 - two core agentic workflow patterns, run against a LOCAL Ollama model.

1) CHAINING (prompt chaining): the output of one call becomes the input to the next.
2) ROUTING: a first call classifies the request, then we route to a branch.

Course parallel: lab2 (2_lab2.py) demonstrates the workflow design patterns.
Here we keep it tiny, local and free.
"""

import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(override=True)

BASE_URL = os.getenv("OPENAI_BASE_URL", "http://localhost:11434/v1")
API_KEY = os.getenv("OPENAI_API_KEY", "ollama")
MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

client = OpenAI(base_url=BASE_URL, api_key=API_KEY)


def ask(content, system=None, max_tokens=150):
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": content})
    resp = client.chat.completions.create(
        model=MODEL, messages=messages, max_tokens=max_tokens, temperature=0.3
    )
    return resp.choices[0].message.content.strip()


def chaining_demo():
    print("\n--- PATTERN 1: CHAINING ---")
    # Call A: generate a topic.
    topic = ask(
        "Name one interesting topic in computer science. Reply with ONLY the topic name, nothing else.",
        max_tokens=20,
    )
    print(f"[call A -> topic] {topic}")

    # Call B: the output of A feeds into B.
    summary = ask(
        f"Explain '{topic}' in exactly one short sentence for a beginner.",
        max_tokens=80,
    )
    print(f"[call B -> uses topic] {summary}")


def routing_demo():
    print("\n--- PATTERN 2: ROUTING ---")
    request = "My laptop won't turn on even though it's plugged in."

    # Router call: classify into a branch.
    category = ask(
        f"Classify this request into exactly one word: TECH, BILLING, or OTHER.\n\nRequest: {request}\n\nReply with ONLY the one word.",
        max_tokens=10,
    ).upper()
    # Normalise in case the model adds punctuation.
    category = "".join(c for c in category if c.isalpha())
    print(f"[router -> branch] {category}")

    branches = {
        "TECH": "You are a hardware support agent. Give one first troubleshooting step.",
        "BILLING": "You are a billing agent. Ask one clarifying question about the charge.",
        "OTHER": "You are a general assistant. Respond helpfully in one sentence.",
    }
    system = branches.get(category, branches["OTHER"])
    answer = ask(request, system=system, max_tokens=80)
    print(f"[branch handled by '{category}'] {answer}")


def main():
    print("=" * 60)
    print(f"MODEL: {MODEL}  (local Ollama, no paid key)")
    print("=" * 60)
    chaining_demo()
    routing_demo()
    print("\n[DONE]")


if __name__ == "__main__":
    main()
