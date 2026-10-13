"""Lab 06: embed chunks, store them, and search by meaning."""
from pathlib import Path

from langchain_core.vectorstores import InMemoryVectorStore

from harbor.config import RUNS, get_embeddings
from harbor.knowledge import load_policies, split

embeddings = get_embeddings()

# 1. An embedding is a list of numbers; similar texts get similar lists.
vector = embeddings.embed_query("When does the library open?")
print(f"1) one embedding: {len(vector)} numbers, starting {[round(x, 3) for x in vector[:4]]}")

# 2. Build the store: every chunk is embedded once.
chunks = split(load_policies())
store = InMemoryVectorStore.from_documents(chunks, embeddings)
print(f"\n2) stored {len(chunks)} chunks")

# 3. Similarity search with scores (cosine similarity: higher is closer).
for question in ["How much do I pay if a book is late?", "Is there Wi-Fi?", "Can I make things with a laser?"]:
    print(f"\n3) {question}")
    for doc, score in store.similarity_search_with_score(question, k=2):
        print(f"   {score:.3f}  {Path(doc.metadata['source']).name:<13} {doc.page_content[:70]!r}")

# 4. Filter on metadata: search only inside one file.
only_branches = store.similarity_search("open on Sunday", k=2,
                                        filter=lambda d: d.metadata["source"].endswith("branches.md"))
print("\n4) filtered to branches.md:", [d.page_content[:50] for d in only_branches])

# 5. Save to disk and load it back without re-embedding.
RUNS.mkdir(exist_ok=True)
store.dump(str(RUNS / "policies_store.json"))
again = InMemoryVectorStore.load(str(RUNS / "policies_store.json"), embeddings)
print("\n5) reloaded store answers:", again.similarity_search("printing price", k=1)[0].page_content[:60])
