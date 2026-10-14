// Read and write the JSONL files used for evaluation.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EVALS } from "./config.js";

export interface Question {
  id: string;
  question: string;
  must_include: string[];
  source: string | null;
  answerable: boolean;
}

export function loadJsonl<T = Record<string, unknown>>(file: string): T[] {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as T);
}

export function saveJsonl(file: string, rows: unknown[]): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, rows.map((row) => JSON.stringify(row) + "\n").join(""), "utf8");
}

export function loadQa(): Question[] {
  return loadJsonl<Question>(path.join(EVALS, "qa.jsonl"));
}
