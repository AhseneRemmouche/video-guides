// Lab 13: build a fine-tuning dataset from your documents: generate, filter, deduplicate, export.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { RUNS } from "../src/config.js";
import { loadDocs } from "../src/docs.js";
import { loadPrompt } from "../src/rag.js";
import { generate, isGrounded, normalize, type QA } from "../src/synth.js";

const kept: [docId: string, pair: QA][] = [];
const seen = new Set<string>();
const stats = { generated: 0, "not grounded": 0, duplicate: 0 };
for (const [docId, text] of Object.entries(loadDocs())) {
  for (const pair of await generate(text)) {
    stats.generated += 1;
    if (!isGrounded(pair, text)) {
      stats["not grounded"] += 1;
      console.log(`  dropped (a number is not in ${docId}): ${JSON.stringify(pair.answer.slice(0, 90))}`);
      continue;
    }
    const key = normalize(pair.question);
    if (seen.has(key)) {
      stats.duplicate += 1;
      continue;
    }
    seen.add(key);
    kept.push([docId, pair]);
  }
}

// Chat format used by most fine-tuning APIs: one JSON object with a "messages" list per line.
const system = loadPrompt("baseline").trim();
const out = path.join(RUNS, "finetune.jsonl");
mkdirSync(RUNS, { recursive: true });
const lines = kept.map(([, pair]) => JSON.stringify({ messages: [
  { role: "system", content: system },
  { role: "user", content: pair.question },
  { role: "assistant", content: pair.answer },
] }) + "\n");
writeFileSync(out, lines.join(""), "utf8");

console.log(`\n${JSON.stringify(stats)} -> kept ${kept.length} examples in runs/${path.basename(out)}`);
for (const [docId, pair] of kept.slice(0, 4)) {
  console.log(`  [${docId}] Q: ${pair.question}\n  ${" ".repeat(docId.length)}   A: ${pair.answer}`);
}
