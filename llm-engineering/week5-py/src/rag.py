"""
Week 5 - RAG query step.

Open the persisted Chroma vector store, build a retriever + prompt +
ChatOllama chain, and answer a question whose answer lives ONLY in the
knowledge/ docs. Prints the question, the retrieved source snippets, and
the locally generated answer.

Run (after ingest.py):  uv run python src/rag.py ["your question"]
"""
import sys

# config MUST be imported first: it installs an SSL shim (see config.py)
# before langchain_ollama / httpx build their SSL context.
from config import (
    OLLAMA_BASE_URL,
    CHAT_MODEL,
    EMBED_MODEL,
    CHROMA_DIR,
    COLLECTION_NAME,
)

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_chroma import Chroma

PROMPT = ChatPromptTemplate.from_messages([
    ("system",
     "You are a knowledgeable assistant for the company Insurellm. "
     "Answer the user's question using ONLY the context below. "
     "If the answer is not in the context, say you don't know. "
     "Keep your answer to one or two short sentences.\n\n"
     "Context:\n{context}"),
    ("human", "{question}"),
])


def format_docs(docs) -> str:
    return "\n\n".join(
        f"[source: {d.metadata.get('source', '?')}]\n{d.page_content}"
        for d in docs
    )


def main() -> None:
    question = (
        sys.argv[1] if len(sys.argv) > 1
        else "Who is the CEO of Insurellm?"
    )

    embeddings = OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_BASE_URL)
    vectorstore = Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=str(CHROMA_DIR),
    )
    retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

    llm = ChatOllama(model=CHAT_MODEL, base_url=OLLAMA_BASE_URL, temperature=0)

    # Retrieve first so we can print the sources, then generate.
    docs = retriever.invoke(question)

    print("=== Insurellm RAG query (fully local via Ollama) ===")
    print(f"Chat model : {CHAT_MODEL}")
    print(f"Embeddings : {EMBED_MODEL}")
    print()
    print(f"QUESTION: {question}")
    print()
    print(f"RETRIEVED SOURCES (top {len(docs)}):")
    for i, d in enumerate(docs, 1):
        snippet = d.page_content.strip().replace("\n", " ")
        if len(snippet) > 220:
            snippet = snippet[:220] + "..."
        print(f"  [{i}] ({d.metadata.get('source', '?')}) {snippet}")
    print()

    chain = PROMPT | llm | StrOutputParser()
    answer = chain.invoke({
        "context": format_docs(docs),
        "question": question,
    })

    print("ANSWER:")
    print(answer.strip())


if __name__ == "__main__":
    main()
