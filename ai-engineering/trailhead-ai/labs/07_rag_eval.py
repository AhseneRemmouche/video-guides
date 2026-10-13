"""Lab 07: the same 20 questions, now answered from retrieved chunks. Compare with the baseline."""
from aie import rag
from aie.docs import load_chunks
from aie.evalset import load_qa
from aie.evaluate import load_run, run, summary
from aie.retrieve import Hybrid

retriever = Hybrid(load_chunks())
rows = run("rag_v2", load_qa(), lambda q: rag.answer(q, retriever, prompt="rag_v2"))

for r in rows:
    mark = "PASS" if r["keyword_pass"] else "fail"
    print(f"{mark}  {r['id']}  {r['answer'][:120]!r}")

print("\nbaseline:", summary(load_run("baseline")))
print("rag_v2:  ", summary(rows))
