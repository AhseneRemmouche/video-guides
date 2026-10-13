"""Run a question set through an answer function and score it with cheap, exact checks."""
from aie.config import RUNS
from aie.evalset import load_jsonl, save_jsonl

REFUSALS = ("i don't know", "i do not know", "don't have information", "not able to find", "no information")


def is_refusal(text):
    return any(r in text.lower().replace("’", "'") for r in REFUSALS)


def keyword_pass(question, answer):
    """Answerable: every must_include string appears. Unanswerable: the answer says it doesn't know."""
    if not question["answerable"]:
        return is_refusal(answer)
    return all(word.lower() in answer.lower() for word in question["must_include"])


def run(name, questions, answer_fn):
    """answer_fn(question_text) -> {"answer": str, "chunks": [...], "reply": Reply}. Saves runs/<name>.jsonl."""
    rows = []
    for q in questions:
        out = answer_fn(q["question"])
        reply = out["reply"]
        rows.append({
            "id": q["id"], "question": q["question"], "answer": out["answer"], "chunks": out.get("chunks", []),
            "keyword_pass": keyword_pass(q, out["answer"]),
            "input_tokens": reply.input_tokens, "output_tokens": reply.output_tokens, "seconds": round(reply.seconds, 2),
        })
    save_jsonl(RUNS / f"{name}.jsonl", rows)
    return rows


def load_run(name):
    return load_jsonl(RUNS / f"{name}.jsonl")


def summary(rows):
    n = len(rows)
    return {
        "cases": n,
        "keyword_pass": sum(r["keyword_pass"] for r in rows) / n,
        "avg_seconds": sum(r["seconds"] for r in rows) / n,
        "avg_input_tokens": sum(r["input_tokens"] for r in rows) / n,
    }
