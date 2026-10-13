"""Lab 04: score the bot before it knows anything about the shop. This is the number to beat."""
from aie import rag
from aie.evalset import load_qa
from aie.evaluate import run, summary

questions = load_qa()
rows = run("baseline", questions, lambda q: rag.answer(q, retriever=None, prompt="baseline"))

for r in rows:
    mark = "PASS" if r["keyword_pass"] else "fail"
    print(f"{mark}  {r['id']}  {r['question']}\n      {r['answer'][:110]!r}")
print("\n", summary(rows))
