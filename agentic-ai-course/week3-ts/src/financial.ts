// Week 3 Day 2 — the financial researcher crew (TypeScript version of 3_crew/financial_researcher)
// The researcher gets the search tool; the analyst receives the research through "context: [research_task]".
import { consoleEvents, loadCrew, runSequential } from "./minicrew.js";
import { searchTool } from "./tools.js";

const inputs = { company: process.argv[2] ?? "Apple" };
const crew = await loadCrew("crews/financial_researcher", inputs);
const outputs = await runSequential(crew, {
  tools: { researcher: [searchTool] },
  outputDir: "output/financial_researcher",
  onEvent: consoleEvents,
});
console.log("\n\n=== FINAL REPORT ===\n\n" + outputs.analysis_task);
console.log("\n\nReport has been saved to output/financial_researcher/output/report.md");
