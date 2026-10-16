// Week 3 Day 4 — the coder crew (TypeScript version of 3_crew/coder)
// CrewAI's allow_code_execution=True + code_execution_mode="safe" runs the agent's Python in Docker.
// Here the agent gets an explicit run_python tool that does the same (no network, 256 MB, 30-second limit).
import { consoleEvents, loadCrew, runSequential } from "./minicrew.js";
import { codeTool } from "./tools.js";

const assignment =
  process.argv[2] ??
  "Write a python program to calculate the first 10,000 terms of this series, multiplying the total by 4: 1 - 1/3 + 1/5 - 1/7 + ...";
const crew = await loadCrew("crews/coder", { assignment });
const outputs = await runSequential(crew, { tools: { coder: [codeTool] }, outputDir: "output/coder", onEvent: consoleEvents });
console.log("\n" + outputs.coding_task);
