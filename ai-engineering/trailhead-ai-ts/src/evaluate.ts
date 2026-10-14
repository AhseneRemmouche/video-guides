// Run a question set through an answer function and score it with cheap, exact checks.
import path from "node:path";
import { RUNS } from "./config.js";
import { loadJsonl, saveJsonl, type Question } from "./evalset.js";
import type { Answer } from "./rag.js";

const REFUSALS = ["i don't know", "i do not know", "don't have information", "not able to find", "no information"];

export function isRefusal(text: string): boolean {
  const t = text.toLowerCase().replaceAll("’", "'");
  return REFUSALS.some((r) => t.includes(r));
}

/** Answerable: every must_include string appears. Unanswerable: the answer says it doesn't know. */
export function keywordPass(question: Pick<Question, "answerable" | "must_include">, answer: string): boolean {
  if (!question.answerable) return isRefusal(answer);
  return question.must_include.every((word) => answer.toLowerCase().includes(word.toLowerCase()));
}

export interface Row {
  id: string;
  question: string;
  answer: string;
  chunks: string[];
  keyword_pass: boolean;
  input_tokens: number;
  output_tokens: number;
  seconds: number;
}

/** Answer every question, one after another, and save runs/<name>.jsonl. */
export async function run(name: string, questions: Question[], answerFn: (q: string) => Promise<Answer>): Promise<Row[]> {
  const rows: Row[] = [];
  for (const q of questions) {
    const out = await answerFn(q.question);
    const reply = out.reply;
    rows.push({
      id: q.id, question: q.question, answer: out.answer, chunks: out.chunks,
      keyword_pass: keywordPass(q, out.answer),
      input_tokens: reply.inputTokens, output_tokens: reply.outputTokens, seconds: Math.round(reply.seconds * 100) / 100,
    });
  }
  saveJsonl(path.join(RUNS, `${name}.jsonl`), rows);
  return rows;
}

export function loadRun(name: string): Row[] {
  return loadJsonl<Row>(path.join(RUNS, `${name}.jsonl`));
}

export function summary(rows: Row[]) {
  const n = rows.length;
  const avg = (f: (r: Row) => number) => rows.reduce((sum, r) => sum + f(r), 0) / n;
  return {
    cases: n,
    keyword_pass: avg((r) => Number(r.keyword_pass)),
    avg_seconds: avg((r) => r.seconds),
    avg_input_tokens: avg((r) => r.input_tokens),
  };
}
