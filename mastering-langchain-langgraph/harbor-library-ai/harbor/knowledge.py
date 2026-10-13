"""Load, split and index the library's policy documents. Labs 04-07 build this step by step."""
from pathlib import Path

from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter

from harbor.config import DATA, get_embeddings


def load_policies():
    loader = DirectoryLoader(str(DATA / "policies"), glob="*.md", loader_cls=TextLoader,
                             loader_kwargs={"encoding": "utf-8"})
    return loader.load()


def split(docs, chunk_size=400, chunk_overlap=60):
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap,
                                              separators=["\n## ", "\n\n", "\n", ". ", " ", ""])
    return splitter.split_documents(docs)


def build_vector_store(chunks=None):
    chunks = chunks if chunks is not None else split(load_policies())
    return InMemoryVectorStore.from_documents(chunks, get_embeddings())


def format_docs(docs):
    """Turn retrieved chunks into one context string, each chunk tagged with its source file."""
    return "\n\n".join(f"[{Path(d.metadata['source']).name}]\n{d.page_content}" for d in docs)
