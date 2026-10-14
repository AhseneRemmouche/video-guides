// Lab 02: the same prompt, sampled several times at different temperatures.
import { chat } from "../src/llm.js";

const PROMPT = "Suggest a name for a bike shop. Reply with the name only.";
const RUNS = 6;

for (const temperature of [0.0, 0.7, 1.5]) {
  const counts = new Map<string, number>();
  for (let i = 0; i < RUNS; i++) {
    const name = (await chat(PROMPT, undefined, { temperature })).text.trim().replace(/^["*.]+|["*.]+$/g, "");
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  console.log(`temperature=${temperature.toFixed(1)}: ${counts.size} different answers out of ${RUNS}`);
  for (const [name, n] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`   ${n} x ${name}`);
}

// A fixed seed makes sampling repeatable on servers that support it (Ollama does).
const a = (await chat(PROMPT, undefined, { temperature: 1.0, seed: 42 })).text;
const b = (await chat(PROMPT, undefined, { temperature: 1.0, seed: 42 })).text;
console.log(`\nseed=42 twice at temperature 1.0: ${JSON.stringify(a)} and ${JSON.stringify(b)} -> same: ${a === b}`);
