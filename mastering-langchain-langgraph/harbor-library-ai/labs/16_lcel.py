"""Lab 16: Runnables and LCEL: the pieces every chain in labs 03-07 was made of."""
from typing import TypedDict

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableLambda, RunnableParallel, RunnablePassthrough

from harbor.config import get_model
from harbor.knowledge import build_vector_store, format_docs

# 1. Any function becomes a Runnable, with invoke / batch / stream for free.
shout = RunnableLambda(lambda text: text.upper())
count = RunnableLambda(len)
print("1) invoke:", shout.invoke("quiet please"), "| batch:", count.batch(["a", "abc", "hello"]))

# 2. The pipe | feeds one Runnable's output into the next (a RunnableSequence).
chain = shout | count
print("2) sequence:", type(chain).__name__, "->", chain.invoke("library"))

# 3. A dict (RunnableParallel) runs branches on the same input; .assign adds keys and keeps the rest.
stats = RunnableParallel(upper=shout, length=count)
print("3) parallel:", stats.invoke("harbor"))
print("   assign:  ", RunnablePassthrough.assign(words=lambda d: len(d["text"].split())).invoke({"text": "open on Sunday"}))


# 4. Type hints document the shapes that flow through a chain, and help your editor catch mistakes.
class Answer(TypedDict):
    question: str
    context: str
    answer: str


retriever = build_vector_store().as_retriever(search_kwargs={"k": 2})
prompt = ChatPromptTemplate.from_template("Answer in one sentence from this context:\n{context}\n\nQuestion: {question}")
rag = (
    RunnableParallel(context=retriever | format_docs, question=RunnablePassthrough())
    | RunnablePassthrough.assign(answer=prompt | get_model() | StrOutputParser())
)
result: Answer = rag.invoke("How much does 3D printing cost?")
print("\n4) RAG with the context kept:", {k: v[:70] for k, v in result.items()})

# 5. Resilience: retry a flaky step, and fall back to another Runnable if it still fails.
attempts = {"n": 0}


def flaky(text):
    attempts["n"] += 1
    if attempts["n"] < 3:
        raise ConnectionError("temporary network problem")
    return f"ok after {attempts['n']} attempts: {text}"


print("5) with_retry:", RunnableLambda(flaky).with_retry(stop_after_attempt=3, wait_exponential_jitter=False).invoke("ping"))
broken = RunnableLambda(lambda _: 1 / 0)
print("   with_fallbacks:", broken.with_fallbacks([RunnableLambda(lambda _: "fallback answer")]).invoke("x"))

# 6. Every chain can describe its input and output schema.
print("6) input schema of the prompt:", prompt.get_input_jsonschema()["required"])
