// Log every request to SQLite so you can debug it later and learn from user feedback.
// node:sqlite is built into Node.js 22.13 and newer: no package to install, nothing to compile.
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { RUNS } from "./config.js";
import type { Answer } from "./rag.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS traces (
    id TEXT PRIMARY KEY, created TEXT, question TEXT, answer TEXT, chunks TEXT,
    model TEXT, input_tokens INT, output_tokens INT, seconds REAL, prompt TEXT
);
CREATE TABLE IF NOT EXISTS feedback (
    trace_id TEXT REFERENCES traces(id), rating INT, comment TEXT, created TEXT
);
`;

export function connect(file = path.join(RUNS, "traces.db")): DatabaseSync {
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  return db;
}

export function logTrace(db: DatabaseSync, question: string, out: Answer, prompt: string): string {
  const traceId = randomUUID().replaceAll("-", "").slice(0, 8);
  const r = out.reply;
  db.prepare("INSERT INTO traces VALUES (?,?,?,?,?,?,?,?,?,?)").run(
    traceId, new Date().toISOString(), question, out.answer, JSON.stringify(out.chunks),
    r.model, r.inputTokens, r.outputTokens, Math.round(r.seconds * 100) / 100, prompt,
  );
  return traceId;
}

/** rating: +1 (thumbs up) or -1 (thumbs down). */
export function logFeedback(db: DatabaseSync, traceId: string, rating: number, comment = ""): void {
  db.prepare("INSERT INTO feedback VALUES (?,?,?,?)").run(traceId, rating, comment, new Date().toISOString());
}
