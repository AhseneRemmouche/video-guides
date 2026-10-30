"""Pricer agent: estimate a fair price for a product description.

In the real Week 8 system the specialist pricer is a fine-tuned LLM deployed
to Modal (pricer-service / Pricer), combined in an EnsembleAgent with a
frontier RAG pricer and a neural-network agent. Here we stub that with a
single short call to a LOCAL Ollama chat model via the OpenAI-compatible API,
so we can verify the agent logic without Modal.
"""

import os
import re

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(override=True)

BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
API_KEY = os.getenv("OLLAMA_API_KEY", "ollama")
MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:latest")

client = OpenAI(base_url=BASE_URL, api_key=API_KEY)

SYSTEM = "You estimate the fair retail price of a product in US dollars. Reply with just a number, no words, no dollar sign."


def get_price(text: str) -> float:
    """Pull the first number out of a model reply."""
    text = text.replace("$", "").replace(",", "")
    match = re.search(r"[-+]?\d*\.\d+|\d+", text)
    return float(match.group()) if match else 0.0


def estimate_price(description: str) -> float:
    """Ask the local model for a fair price. Short prompt, parse a number."""
    user = f"How much does this cost?\n\n{description}\n\nPrice in dollars:"
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user},
        ],
        temperature=0.0,
        max_tokens=20,
    )
    reply = response.choices[0].message.content or ""
    return get_price(reply)


if __name__ == "__main__":
    demo = "Sony WH-1000XM5 wireless noise-cancelling headphones, brand new"
    print(f"Model: {MODEL}")
    print(f"Estimate for: {demo}")
    print(f"  -> ${estimate_price(demo):.2f}")
