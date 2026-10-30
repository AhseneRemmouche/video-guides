"""
Week 5 - Ingestion step.

Load the knowledge/*.md docs, split them into overlapping chunks,
embed each chunk locally with Ollama's nomic-embed-text, and persist
the vectors into a local Chroma vector store.

Run:  uv run python src/ingest.py
"""
# config MUST be imported first: it installs an SSL shim (see config.py)
# before langchain_ollama / httpx build their SSL context.
from config import (
    OLLAMA_BASE_URL,
    EMBED_MODEL,
    KNOWLEDGE_DIR,
    CHROMA_DIR,
    COLLECTION_NAME,
    CHUNK_SIZE,
    CHUNK_OVERLAP,
)

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings
from langchain_chroma import Chroma


def load_documents() -> list[Document]:
    """Load every .md file under knowledge/ as a LangChain Document."""
    documents: list[Document] = []
    for md_path in sorted(KNOWLEDGE_DIR.glob("*.md")):
        text = md_path.read_text(encoding="utf-8")
        documents.append(
            Document(
                page_content=text,
                metadata={"source": md_path.name},
            )
        )
    print(f"Loaded {len(documents)} documents from {KNOWLEDGE_DIR}")
    for d in documents:
        print(f"  - {d.metadata['source']} ({len(d.page_content)} chars)")
    return documents


def split_documents(documents: list[Document]) -> list[Document]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
    )
    chunks = splitter.split_documents(documents)
    print(f"Split into {len(chunks)} chunks "
          f"(chunk_size={CHUNK_SIZE}, chunk_overlap={CHUNK_OVERLAP})")
    return chunks


def build_vectorstore(chunks: list[Document]) -> Chroma:
    embeddings = OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_BASE_URL)

    # Fresh build each time: wipe any existing persisted collection.
    vectorstore = Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=str(CHROMA_DIR),
    )
    try:
        vectorstore.delete_collection()
    except Exception:
        pass

    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        collection_name=COLLECTION_NAME,
        persist_directory=str(CHROMA_DIR),
    )
    count = vectorstore._collection.count()
    print(f"Vector store persisted at {CHROMA_DIR} with {count} vectors "
          f"(embedding model: {EMBED_MODEL})")
    return vectorstore


def main() -> None:
    print("=== Insurellm RAG ingestion (fully local via Ollama) ===")
    documents = load_documents()
    chunks = split_documents(documents)
    build_vectorstore(chunks)
    print("Ingestion complete.")


if __name__ == "__main__":
    main()
