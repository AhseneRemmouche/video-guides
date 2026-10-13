"""Generate question-answer pairs from the documents, then filter them."""
import re

from pydantic import BaseModel

from aie.llm import chat_json


class QA(BaseModel):
    question: str
    answer: str


class QAList(BaseModel):
    pairs: list[QA]


GEN_PROMPT = """Write {n} different questions a customer might ask that this document answers,
each with a short correct answer taken from the document. Vary the wording; some questions should be casual.
Reply with JSON: {{"pairs": [{{"question": "...", "answer": "..."}}]}}"""


def generate(doc_text, n=4):
    messages = [{"role": "system", "content": GEN_PROMPT.format(n=n)}, {"role": "user", "content": doc_text}]
    return chat_json(messages, QAList, temperature=0.8).pairs


def normalize(text):
    return " ".join("".join(ch for ch in text.lower() if ch.isalnum() or ch == " ").split())


def is_grounded(pair, doc_text):
    """Cheap filter: every number in the answer must appear in the document."""
    return all(num in doc_text for num in re.findall(r"\d+(?:[.,]\d+)?", pair.answer))
