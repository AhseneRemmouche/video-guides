"""Lab 05: split documents into chunks that fit a prompt and still make sense alone."""
from pathlib import Path

from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

from harbor.knowledge import load_policies

docs = load_policies()

# 1. The general-purpose splitter: tries "\n\n", then "\n", then " ", then characters.
plain = RecursiveCharacterTextSplitter(chunk_size=200, chunk_overlap=40)
chunks = plain.split_documents(docs)
sizes = [len(c.page_content) for c in chunks]
print(f"1) Recursive, size 200 / overlap 40: {len(chunks)} chunks, {min(sizes)}-{max(sizes)} characters")
fees = [c for c in chunks if Path(c.metadata["source"]).name == "fees.md"]
for c in fees[:3]:
    print(f"   {c.page_content[:90]!r}")

# 2. Bigger chunks, and separators that prefer to cut at a "## " heading (what harbor/knowledge.py uses).
smart = RecursiveCharacterTextSplitter(chunk_size=400, chunk_overlap=60,
                                       separators=["\n## ", "\n\n", "\n", ". ", " ", ""])
chunks = smart.split_documents(docs)
print(f"\n2) Recursive, size 400, heading-first: {len(chunks)} chunks")
print("   example:", repr(chunks[3].page_content[:120]))

# 3. Split on Markdown headings and keep the headings as metadata.
md = MarkdownHeaderTextSplitter(headers_to_split_on=[("#", "page"), ("##", "section")])
sections = [s for d in docs for s in md.split_text(d.page_content)]
print(f"\n3) MarkdownHeaderTextSplitter: {len(sections)} sections")
for s in sections[:3]:
    print(f"   {s.metadata}  {s.page_content[:60]!r}")
