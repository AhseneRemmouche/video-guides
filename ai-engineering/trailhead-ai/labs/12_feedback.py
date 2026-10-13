"""Lab 12: trace every answer, collect thumbs up/down, and turn bad answers into new eval cases."""
from aie import rag
from aie.config import EVALS
from aie.docs import load_chunks
from aie.evalset import save_jsonl
from aie.retrieve import Hybrid
from aie.tracing import connect, log_feedback, log_trace

retriever = Hybrid(load_chunks())
db = connect()
db.execute("DELETE FROM feedback")
db.execute("DELETE FROM traces")

# Simulated traffic: (question, the customer's rating, their comment)
traffic = [
    ("Can I return a bike I rode 80 km?", -1, "Unfair policy, I only rode it twice"),
    ("Do you ship to Italy?", +1, ""),
    ("How long does a full service take?", +1, ""),
    ("Can I cancel Trailhead Care?", +1, ""),
    ("Is express shipping available for helmets?", -1, "Not clear"),
]
for question, rating, comment in traffic:
    out = rag.answer(question, retriever, prompt="rag_v2")
    trace_id = log_trace(db, question, out, "rag_v2")
    log_feedback(db, trace_id, rating, comment)
    print(f"{trace_id}  {'+1' if rating > 0 else '-1'}  {question}\n          {out['answer'][:130]!r}")

print("\nDashboard")
row = db.execute("""SELECT COUNT(*), AVG(seconds), AVG(input_tokens), AVG(output_tokens),
                    AVG(CASE WHEN f.rating > 0 THEN 1.0 ELSE 0 END)
                    FROM traces t JOIN feedback f ON f.trace_id = t.id""").fetchone()
print(f"  {row[0]} answers, {row[1]:.1f} s average, {row[2]:.0f} input / {row[3]:.0f} output tokens, {row[4]:.0%} thumbs up")

bad = db.execute("""SELECT t.id, t.question, t.answer, f.comment FROM traces t JOIN feedback f ON f.trace_id = t.id
                    WHERE f.rating < 0""").fetchall()
new_cases = [{"id": f"fb-{tid}", "question": q, "bad_answer": a, "user_comment": c,
              "status": "needs a human to write the expected answer"} for tid, q, a, c in bad]
save_jsonl(EVALS / "from_feedback.jsonl", new_cases)
print(f"\n{len(new_cases)} thumbs-down answers saved to evals/from_feedback.jsonl for review:")
for c in new_cases:
    print(f"  {c['id']}: {c['question']}  (user: {c['user_comment']!r})")
