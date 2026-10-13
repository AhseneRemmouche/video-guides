"""Answer a question with or without retrieved context."""
from aie.config import PROMPTS
from aie.llm import chat


def load_prompt(name):
    return (PROMPTS / f"{name}.txt").read_text(encoding="utf-8")


def format_context(results):
    return "\n\n".join(f"[{chunk.id}]\n{chunk.text}" for chunk, _ in results)


def answer(question, retriever=None, prompt="rag_v2", k=3, model=None):
    """Return {"answer", "chunks", "reply"}. Without a retriever, the model answers from memory."""
    results = retriever.search(question, k=k) if retriever else []
    system = load_prompt(prompt).format(context=format_context(results)) if retriever else load_prompt(prompt)
    reply = chat([{"role": "system", "content": system}, {"role": "user", "content": question}], model=model, temperature=0)
    return {"answer": reply.text, "chunks": [chunk.id for chunk, _ in results], "reply": reply}
