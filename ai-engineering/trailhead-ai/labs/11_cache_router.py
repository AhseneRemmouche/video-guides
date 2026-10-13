"""Lab 11: save time and money with caches and a router."""
import time

from aie import rag
from aie.cache import ExactCache, SemanticCache
from aie.docs import load_chunks
from aie.retrieve import Hybrid
from aie.router import route

retriever = Hybrid(load_chunks())
exact, semantic = ExactCache(), SemanticCache(threshold=0.9)


def answer(question):
    start = time.perf_counter()
    if (hit := exact.get(question)) is not None:
        return hit, "exact cache", time.perf_counter() - start
    hit, similarity = semantic.get(question)
    if hit is not None:
        return hit, f"semantic cache (similarity {similarity:.2f})", time.perf_counter() - start
    text = rag.answer(question, retriever)["answer"]
    exact.put(question, text)
    semantic.put(question, text)
    return text, f"model (closest cached question: {similarity:.2f})", time.perf_counter() - start


print("1) Caching")
for q in ["How long does standard shipping take?",
          "How long does standard shipping take?",
          "how long does standard shipping take",
          "How many days does standard delivery take?",
          "How long does express shipping take?"]:
    text, source, seconds = answer(q)
    print(f"   {seconds:6.2f} s  {source:<40} {q}")
print("   Careful: a semantic cache must not answer the express question with the standard answer.")

print("\n2) Routing")
REPLIES = {"smalltalk": "You're welcome! Anything else I can help with?",
           "out_of_scope": "I can only help with Trailhead Bikes questions."}
for m in ["Thanks a lot!", "Do you ship to Belgium?", "Where is my order TH-10260?", "Write me a poem about cats"]:
    start = time.perf_counter()
    r = route(m)
    note = REPLIES.get(r, "-> RAG bot" if r == "policy_question" else "-> agent with order tools")
    print(f"   {r:<16} {time.perf_counter() - start:5.1f} s  {m!r}: {note}")
