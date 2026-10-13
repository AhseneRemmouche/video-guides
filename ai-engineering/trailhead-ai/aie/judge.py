"""An AI judge: a (usually stronger) model grades an answer against the reference document."""
from typing import Literal

from pydantic import BaseModel

from aie import config
from aie.docs import load_docs
from aie.llm import chat_json

RUBRIC = """You grade answers from a bike shop's support assistant.

You get the customer's question, the shop's reference document and the assistant's answer.
The answer is CORRECT when:
- it answers the question the way the reference document does, and
- it states no number, policy or fact that contradicts or is missing from the reference.
If the reference says no document covers the question, the answer is CORRECT only if it says it doesn't know
or points to support, without inventing facts.
Extra politeness or advice that adds no new facts is fine.

First explain your reasoning in two or three sentences, then give the verdict."""


class Verdict(BaseModel):
    reasoning: str
    verdict: Literal["correct", "incorrect"]


def judge(question, answer, source):
    reference = load_docs()[source] if source else "No document covers this question."
    prompt = f"QUESTION:\n{question}\n\nREFERENCE DOCUMENT:\n{reference}\n\nASSISTANT'S ANSWER:\n{answer}"
    return chat_json(
        [{"role": "system", "content": RUBRIC}, {"role": "user", "content": prompt}],
        Verdict, model=config.JUDGE_MODEL, temperature=0,
    )
