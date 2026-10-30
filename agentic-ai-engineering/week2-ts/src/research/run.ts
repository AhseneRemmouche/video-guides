// CLI entry for the deep-research pipeline (npm run research "your query").
// Streams the manager's status updates to the console and prints the final markdown report.
import { ResearchManager } from "./manager.js";

const query = process.argv.slice(2).join(" ").trim() || "Latest AI Agent frameworks in 2025";
console.log(`Deep research query: ${query}\n`);

const manager = new ResearchManager();
for await (const chunk of manager.run(query)) {
  console.log(chunk.length > 200 ? ">> " + chunk.slice(0, 200) + " ..." : ">> " + chunk);
}

if (manager.report) {
  console.log("\n--- short summary ---\n" + manager.report.short_summary);
}
console.log("\nDone.");
