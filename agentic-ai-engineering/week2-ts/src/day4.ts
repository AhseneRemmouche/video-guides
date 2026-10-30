// Week 2 Day 4 - deep research in the console (TypeScript port of 2_openai/4_lab4.py).
// Builds the same pipeline the notebook assembles step by step: plan -> search (parallel) -> write -> email,
// all orchestrated by the ResearchManager.
import { ResearchManager } from "./research/manager.js";

const query = process.argv.slice(2).join(" ").trim() || "Latest AI Agent frameworks in 2025";

for await (const chunk of new ResearchManager().run(query)) {
  console.log("\n>>", chunk.length > 200 ? chunk.slice(0, 200) + " ..." : chunk);
}
console.log("\nHooray!");
