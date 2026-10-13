"""Load the knowledge base and split it into chunks."""
from dataclasses import dataclass

from aie.config import DATA


@dataclass
class Chunk:
    id: str      # "returns#0"
    doc: str     # "returns"
    title: str   # "Returns and refunds"
    text: str


def load_docs():
    """Return {doc_id: markdown text} for every file in data/docs."""
    return {p.stem: p.read_text(encoding="utf-8") for p in sorted((DATA / "docs").glob("*.md"))}


def chunk_doc(doc_id, text, max_words=60, overlap=1):
    """Split one document into chunks of whole paragraphs, about max_words long.

    Each chunk repeats the last `overlap` paragraphs of the previous one, and every chunk starts
    with the document title so it still makes sense on its own.
    """
    lines = text.strip().splitlines()
    title = lines[0].lstrip("# ").strip()
    paragraphs = [p.strip() for p in "\n".join(lines[1:]).split("\n\n") if p.strip()]
    chunks, current = [], []
    for para in paragraphs:
        if current and sum(len(p.split()) for p in current) + len(para.split()) > max_words:
            chunks.append(current)
            current = current[-overlap:] if overlap else []
        current.append(para)
    if current:
        chunks.append(current)
    return [Chunk(f"{doc_id}#{i}", doc_id, title, f"{title}\n\n" + "\n\n".join(c)) for i, c in enumerate(chunks)]


def load_chunks(max_words=60, overlap=1):
    return [c for doc_id, text in load_docs().items() for c in chunk_doc(doc_id, text, max_words, overlap)]
