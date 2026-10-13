"""Lab 04: load files into LangChain Documents (text + metadata)."""
from pathlib import Path

from langchain_community.document_loaders import CSVLoader, DirectoryLoader, TextLoader

from harbor.config import DATA

# 1. One file.
doc = TextLoader(str(DATA / "policies" / "loans.md"), encoding="utf-8").load()[0]
print("1) TextLoader:", type(doc).__name__, "| metadata:", {"source": Path(doc.metadata["source"]).name})
print("   first 80 characters:", repr(doc.page_content[:80]))

# 2. A whole folder: one Document per file.
policies = DirectoryLoader(str(DATA / "policies"), glob="*.md", loader_cls=TextLoader,
                           loader_kwargs={"encoding": "utf-8"}).load()
print(f"\n2) DirectoryLoader: {len(policies)} documents")
for d in policies:
    print(f"   {Path(d.metadata['source']).name:<16} {len(d.page_content):>5} characters")

# 3. A CSV: one Document per row. source_column decides what goes into metadata["source"].
books = CSVLoader(str(DATA / "catalog.csv"), source_column="id", encoding="utf-8",
                  metadata_columns=["branch", "format", "available"]).load()
print(f"\n3) CSVLoader: {len(books)} documents (one per row)")
print("   page_content:", repr(books[0].page_content[:120]))
print("   metadata:    ", books[0].metadata)

# 4. Metadata is what lets you filter later: here, books available right now.
available = [b for b in books if b.metadata["available"] != "0"]
print(f"\n4) {len(available)} of {len(books)} titles have a copy on the shelf")
