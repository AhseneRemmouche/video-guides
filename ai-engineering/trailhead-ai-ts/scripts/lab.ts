// Run a lab by its number: `pnpm lab 07` runs labs/07-rag-eval.ts.
import { readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const num = (process.argv[2] ?? "").padStart(2, "0");
const labsDir = path.resolve(import.meta.dirname, "..", "labs");
const file = readdirSync(labsDir).find((f) => f.startsWith(`${num}-`) && f.endsWith(".ts"));
if (!file) {
  console.error(`No lab ${num}. Usage: pnpm lab 01`);
  process.exit(1);
}
await import(pathToFileURL(path.join(labsDir, file)).href);
