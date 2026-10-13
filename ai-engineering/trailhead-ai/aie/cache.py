"""Two caches: exact (same text) and semantic (similar meaning)."""
import numpy as np

from aie.llm import embed


class ExactCache:
    def __init__(self):
        self.store = {}

    @staticmethod
    def key(text):
        return " ".join(text.lower().split())

    def get(self, text):
        return self.store.get(self.key(text))

    def put(self, text, answer):
        self.store[self.key(text)] = answer


class SemanticCache:
    """Returns a stored answer when a new question is close enough to a previous one."""

    def __init__(self, threshold=0.9):
        self.threshold, self.vectors, self.answers = threshold, [], []

    def _vector(self, text):
        v = np.array(embed([f"search_query: {text}"])[0], dtype=np.float32)
        return v / np.linalg.norm(v)

    def get(self, text):
        if not self.vectors:
            return None, 0.0
        v = self._vector(text)
        sims = np.array(self.vectors) @ v
        best = int(np.argmax(sims))
        return (self.answers[best] if sims[best] >= self.threshold else None), float(sims[best])

    def put(self, text, answer):
        self.vectors.append(self._vector(text))
        self.answers.append(answer)
