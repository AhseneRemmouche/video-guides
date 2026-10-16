// Week 3 Day 1 — the debate crew (TypeScript version of 3_crew/debate)
// crews/debate/agents.yaml and tasks.yaml are copied unchanged from the course repo.
import { consoleEvents, loadCrew, runSequential } from "./minicrew.js";

const inputs = { motion: process.argv[2] ?? "There needs to be strict laws to regulate LLMs" };
const crew = await loadCrew("crews/debate", inputs);
const outputs = await runSequential(crew, { outputDir: "output/debate", onEvent: consoleEvents });
console.log("\n=== DECISION ===\n" + outputs.decide);
