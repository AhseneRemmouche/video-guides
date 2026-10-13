"""Lab 07: compare retrievers on 12 questions, then answer with a RAG chain."""
import json
import logging
import sys
from pathlib import Path

from langchain_classic.retrievers import EnsembleRetriever, MultiQueryRetriever
from langchain_community.retrievers import BM25Retriever
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough

from harbor.config import ROOT, get_model
from harbor.knowledge import build_vector_store, format_docs, load_policies, split

chunks = split(load_policies())
store = build_vector_store(chunks)
questions = [json.loads(line) for line in open(ROOT / "evals" / "questions.jsonl", encoding="utf-8")]

dense = store.as_retriever(search_kwargs={"k": 2})
mmr = store.as_retriever(search_type="mmr", search_kwargs={"k": 2, "fetch_k": 6})
bm25 = BM25Retriever.from_documents(chunks, k=2)
hybrid = EnsembleRetriever(retrievers=[bm25, dense], weights=[0.5, 0.5])
multi = MultiQueryRetriever.from_llm(retriever=dense, llm=get_model())

print("1) Did the right file come back in the results?")
for name, retriever in [("vector", dense), ("MMR", mmr), ("BM25", bm25), ("hybrid", hybrid), ("multi-query", multi)]:
    hits, misses = 0, []
    for q in questions:
        files = {Path(d.metadata["source"]).name for d in retriever.invoke(q["question"])}
        if q["source"] in files:
            hits += 1
        else:
            misses.append(q["question"])
    print(f"   {name:<12} {hits}/{len(questions)}   missed: {misses}")

# Multi-query asks the model for other phrasings of the question. Turn on its log to see them.
print("\n   The phrasings multi-query generated for 'What is the Wi-Fi password?':")
logging.basicConfig(stream=sys.stdout, format="   %(message)s")
logging.getLogger("langchain_classic.retrievers.multi_query").setLevel(logging.INFO)
multi.invoke("What is the Wi-Fi password?")

# 2. A RAG chain: retrieve -> fill the prompt -> model -> string.
prompt = ChatPromptTemplate.from_messages([
    ("system", "You answer questions about Harbor City Library using only the context below. "
               "If the context does not contain the answer, say you don't know. "
               "End with the source file in brackets.\n\nContext:\n{context}"),
    ("human", "{question}"),
])
rag = {"context": hybrid | format_docs, "question": RunnablePassthrough()} | prompt | get_model() | StrOutputParser()

print("\n2) RAG answers")
for q in questions[:4] + [{"question": "Can I bring my dog to the library?"}]:
    print(f"   Q: {q['question']}\n   A: {rag.invoke(q['question'])}")
