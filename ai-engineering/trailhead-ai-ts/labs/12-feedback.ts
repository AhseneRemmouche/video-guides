// Lab 12: trace every answer, collect thumbs up/down, and turn bad answers into new eval cases.
import path from "node:path";
import * as rag from "../src/rag.js";
import { EVALS } from "../src/config.js";
import { loadChunks } from "../src/docs.js";
import { saveJsonl } from "../src/evalset.js";
import { Hybrid } from "../src/retrieve.js";
import { connect, logFeedback, logTrace } from "../src/tracing.js";

const retriever = new Hybrid(loadChunks());
const db = connect();
db.exec("DELETE FROM feedback");
db.exec("DELETE FROM traces");

// Simulated traffic: (question, the customer's rating, their comment)
const traffic: [string, number, string][] = [
  ["Can I return a bike I rode 80 km?", -1, "Unfair policy, I only rode it twice"],
  ["Do you ship to Italy?", +1, ""],
  ["How long does a full service take?", +1, ""],
  ["Can I cancel Trailhead Care?", +1, ""],
  ["Is express shipping available for helmets?", -1, "Not clear"],
];
for (const [question, rating, comment] of traffic) {
  const out = await rag.answer(question, retriever, "rag_v2");
  const traceId = logTrace(db, question, out, "rag_v2");
  logFeedback(db, traceId, rating, comment);
  console.log(`${traceId}  ${rating > 0 ? "+1" : "-1"}  ${question}\n          ${JSON.stringify(out.answer.slice(0, 130))}`);
}

console.log("\nDashboard");
const row = db.prepare(`SELECT COUNT(*) AS n, AVG(seconds) AS secs, AVG(input_tokens) AS tin, AVG(output_tokens) AS tout,
                        AVG(CASE WHEN f.rating > 0 THEN 1.0 ELSE 0 END) AS up
                        FROM traces t JOIN feedback f ON f.trace_id = t.id`).get() as Record<string, number>;
console.log(`  ${row.n} answers, ${row.secs!.toFixed(1)} s average, ${Math.round(row.tin!)} input / ${Math.round(row.tout!)} output tokens, ` +
  `${Math.round(100 * row.up!)}% thumbs up`);

const bad = db.prepare(`SELECT t.id, t.question, t.answer, f.comment FROM traces t JOIN feedback f ON f.trace_id = t.id
                        WHERE f.rating < 0`).all() as { id: string; question: string; answer: string; comment: string }[];
const newCases = bad.map((b) => ({
  id: `fb-${b.id}`, question: b.question, bad_answer: b.answer, user_comment: b.comment,
  status: "needs a human to write the expected answer",
}));
saveJsonl(path.join(EVALS, "from_feedback.jsonl"), newCases);
console.log(`\n${newCases.length} thumbs-down answers saved to evals/from_feedback.jsonl for review:`);
for (const c of newCases) console.log(`  ${c.id}: ${c.question}  (user: ${JSON.stringify(c.user_comment)})`);
