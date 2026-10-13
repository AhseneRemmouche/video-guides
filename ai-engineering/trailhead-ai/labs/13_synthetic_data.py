"""Lab 13: build a fine-tuning dataset from your documents: generate, filter, deduplicate, export."""
import json

from aie.config import RUNS
from aie.docs import load_docs
from aie.rag import load_prompt
from aie.synth import generate, is_grounded, normalize

kept, seen = [], set()
stats = {"generated": 0, "not grounded": 0, "duplicate": 0}
for doc_id, text in load_docs().items():
    for pair in generate(text):
        stats["generated"] += 1
        if not is_grounded(pair, text):
            stats["not grounded"] += 1
            print(f"  dropped (a number is not in {doc_id}): {pair.answer[:90]!r}")
            continue
        key = normalize(pair.question)
        if key in seen:
            stats["duplicate"] += 1
            continue
        seen.add(key)
        kept.append((doc_id, pair))

# Chat format used by most fine-tuning APIs: one JSON object with a "messages" list per line.
system = load_prompt("baseline").strip()
out = RUNS / "finetune.jsonl"
out.parent.mkdir(exist_ok=True)
with open(out, "w", encoding="utf-8", newline="\n") as f:
    for _, pair in kept:
        f.write(json.dumps({"messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": pair.question},
            {"role": "assistant", "content": pair.answer}]}, ensure_ascii=False) + "\n")

print(f"\n{stats} -> kept {len(kept)} examples in runs/{out.name}")
for doc_id, pair in kept[:4]:
    print(f"  [{doc_id}] Q: {pair.question}\n  {' ' * len(doc_id)}   A: {pair.answer}")
