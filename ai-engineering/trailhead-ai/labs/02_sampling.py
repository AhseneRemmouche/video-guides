"""Lab 02: the same prompt, sampled several times at different temperatures."""
from collections import Counter

from aie.llm import chat

PROMPT = "Suggest a name for a bike shop. Reply with the name only."
RUNS = 6

for temperature in (0.0, 0.7, 1.5):
    names = [chat(PROMPT, temperature=temperature).text.strip().strip('"*.') for _ in range(RUNS)]
    counts = Counter(names)
    print(f"temperature={temperature}: {len(counts)} different answers out of {RUNS}")
    for name, n in counts.most_common():
        print(f"   {n} x {name}")

# A fixed seed makes sampling repeatable on servers that support it (Ollama does).
a = chat(PROMPT, temperature=1.0, seed=42).text
b = chat(PROMPT, temperature=1.0, seed=42).text
print(f"\nseed=42 twice at temperature 1.0: {a!r} and {b!r} -> same: {a == b}")
