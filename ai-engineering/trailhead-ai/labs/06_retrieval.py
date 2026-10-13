"""Lab 06: measure three retrievers on the questions whose source document we know."""
from aie.docs import load_chunks
from aie.evalset import load_qa
from aie.retrieve import BM25, EmbeddingIndex, Hybrid

chunks = load_chunks()
print(f"{len(chunks)} chunks from {len({c.doc for c in chunks})} documents\n")

questions = [q for q in load_qa() if q["source"]]
retrievers = {"BM25": BM25(chunks), "Embeddings": EmbeddingIndex(chunks), "Hybrid (RRF)": Hybrid(chunks)}
K = 3

print(f"{'retriever':<14}{'hit@1':>8}{'hit@3':>8}{'MRR':>8}")
misses = {}
for name, retriever in retrievers.items():
    hit1 = hit3 = rr = 0.0
    for q in questions:
        docs = [chunk.doc for chunk, _ in retriever.search(q["question"], k=K)]
        if q["source"] in docs:
            rank = docs.index(q["source"]) + 1
            hit1 += rank == 1
            hit3 += 1
            rr += 1 / rank
        else:
            misses.setdefault(name, []).append((q["id"], q["question"], docs))
    n = len(questions)
    print(f"{name:<14}{hit1 / n:>8.0%}{hit3 / n:>8.0%}{rr / n:>8.2f}")

for name, rows in misses.items():
    print(f"\nMissed by {name}:")
    for qid, question, docs in rows:
        print(f"  {qid} {question}  ->  {docs}")
