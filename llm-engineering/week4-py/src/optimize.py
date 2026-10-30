"""Week 4: Python -> C++ code optimizer, running against a local Ollama model.

This mirrors Ed Donner's LLM Engineering Week 4 "code optimizer": feed a slow
piece of Python to a model and ask it to rewrite it as fast C++. In the course
the C++ is then compiled and timed against the Python to measure a real speedup.
Here we only *generate* the C++ (see compile_note.py for why the compile+time
step is skipped on this machine).
"""

import os
import re
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(override=True)

MODEL = os.getenv("OPTIMIZE_MODEL", "llama3.2:latest")
BASE_URL = os.getenv("OPENAI_BASE_URL", "http://localhost:11434/v1")
API_KEY = os.getenv("OPENAI_API_KEY", "ollama")

# Local Ollama speaks the OpenAI API at /v1. The api_key just has to be non-empty.
client = OpenAI(base_url=BASE_URL, api_key=API_KEY)

SYSTEM_PROMPT = "Rewrite this Python in C++ for maximum speed; reply with only the C++ code."

# A deliberately slow sample: an O(n) Python loop summing numbers.
SAMPLE_PYTHON = """\
def sum_to(n):
    total = 0
    for i in range(1, n + 1):
        total += i
    return total

print(sum_to(100_000_000))
"""


def strip_fences(text: str) -> str:
    """Remove a leading ```cpp / ``` fence and a trailing ``` fence."""
    text = re.sub(r"^\s*```(?:cpp|c\+\+)?\s*\n", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


def optimize(python_code: str, model: str = MODEL) -> str:
    """Stream a C++ rewrite of `python_code` from the local model and return it."""
    stream = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": python_code},
        ],
        stream=True,
    )
    chunks = []
    for chunk in stream:
        piece = chunk.choices[0].delta.content or ""
        print(piece, end="", flush=True)
        chunks.append(piece)
    print()
    return strip_fences("".join(chunks))


if __name__ == "__main__":
    print(f"Model: {MODEL}  (via {BASE_URL})")
    print("--- Python to optimize ---")
    print(SAMPLE_PYTHON)
    print("--- Streaming C++ from the model ---")
    cpp = optimize(SAMPLE_PYTHON)
    print("\n--- Cleaned C++ ---")
    print(cpp)
