// Week 2 Day 4 — deep research in the console (TypeScript version of 2_openai/4_lab4.ipynb)
// The same pipeline the notebook builds step by step: plan → search (in parallel) → write → email.
import { ResearchManager } from "./deep_research/manager.js";

const query = process.argv[2] ?? "Latest AI Agent frameworks in 2025";
for await (const chunk of new ResearchManager().run(query)) {
  console.log("\n>>", chunk.length > 200 ? chunk.slice(0, 200) + " ..." : chunk);
}
console.log("Hooray!");
