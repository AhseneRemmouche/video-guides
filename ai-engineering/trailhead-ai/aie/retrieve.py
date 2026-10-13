"""Three retrievers over the same chunks: BM25 (keywords), embeddings (meaning) and hybrid (both)."""
import math
import re
from collections import Counter

import numpy as np

from aie.llm import embed

STOPWORDS = set("a an and are as at be can do does for from how i in is it my of on or the to what when where which who with you your".split())


def tokenize(text):
    return [w for w in re.findall(r"[a-z0-9]+(?:\.[0-9]+)?", text.lower()) if w not in STOPWORDS]


class BM25:
    """Okapi BM25: scores a chunk higher when it contains rare query words, often, in a short text."""

    def __init__(self, chunks, k1=1.5, b=0.75):
        self.chunks, self.k1, self.b = chunks, k1, b
        self.docs = [Counter(tokenize(c.text)) for c in chunks]
        self.lengths = [sum(d.values()) for d in self.docs]
        self.avg_len = sum(self.lengths) / len(self.lengths)
        n = len(chunks)
        df = Counter(word for d in self.docs for word in d)
        self.idf = {w: math.log(1 + (n - f + 0.5) / (f + 0.5)) for w, f in df.items()}

    def search(self, query, k=3):
        scores = []
        for doc, length in zip(self.docs, self.lengths):
            score = 0.0
            for word in tokenize(query):
                tf = doc.get(word, 0)
                if tf:
                    norm = tf + self.k1 * (1 - self.b + self.b * length / self.avg_len)
                    score += self.idf[word] * tf * (self.k1 + 1) / norm
            scores.append(score)
        order = np.argsort(scores)[::-1][:k]
        return [(self.chunks[i], float(scores[i])) for i in order]


class EmbeddingIndex:
    """Embeds every chunk once; a query is embedded and compared by cosine similarity."""

    def __init__(self, chunks):
        self.chunks = chunks
        # nomic-embed-text expects these task prefixes; other embedding models simply ignore them.
        self.matrix = self._normalize(embed([f"search_document: {c.text}" for c in chunks]))

    @staticmethod
    def _normalize(vectors):
        m = np.array(vectors, dtype=np.float32)
        return m / np.linalg.norm(m, axis=1, keepdims=True)

    def search(self, query, k=3):
        q = self._normalize(embed([f"search_query: {query}"]))[0]
        scores = self.matrix @ q
        order = np.argsort(scores)[::-1][:k]
        return [(self.chunks[i], float(scores[i])) for i in order]


def reciprocal_rank_fusion(result_lists, k=3, c=60):
    """Merge ranked lists: each chunk gets 1/(c + rank) from every list it appears in."""
    scores, by_id = {}, {}
    for results in result_lists:
        for rank, (chunk, _) in enumerate(results, start=1):
            scores[chunk.id] = scores.get(chunk.id, 0.0) + 1 / (c + rank)
            by_id[chunk.id] = chunk
    best = sorted(scores, key=scores.get, reverse=True)[:k]
    return [(by_id[i], scores[i]) for i in best]


class Hybrid:
    def __init__(self, chunks):
        self.bm25, self.dense = BM25(chunks), EmbeddingIndex(chunks)

    def search(self, query, k=3, pool=10):
        return reciprocal_rank_fusion([self.bm25.search(query, pool), self.dense.search(query, pool)], k=k)
