// Week 3 Days 3–4 — the stock picker crew (TypeScript version of 3_crew/stock_picker)
// Structured outputs (CrewAI's output_pydantic) become zod schemas; the crew runs hierarchically: a manager agent
// delegates every task to the three workers. Day 4's memory is a JSON file read into two agents' prompts (memory.ts).
import { z } from "zod";
import { consoleEvents, loadCrew, runHierarchical } from "./minicrew.js";
import { pushTool, searchTool } from "./tools.js";
import { memoryPrompt, recall, remember } from "./memory.js";

const TrendingCompany = z.object({
  name: z.string().describe("Company name"),
  ticker: z.string().describe("Stock ticker symbol"),
  reason: z.string().describe("Reason this company is trending in the news"),
});
const TrendingCompanyList = z.object({
  companies: z.array(TrendingCompany).describe("List of companies trending in the news"),
});
const TrendingCompanyResearch = z.object({
  name: z.string().describe("Company name"),
  market_position: z.string().describe("Current market position and competitive analysis"),
  future_outlook: z.string().describe("Future outlook and growth prospects"),
  investment_potential: z.string().describe("Investment potential and suitability for investment"),
});
const TrendingCompanyResearchList = z.object({
  research_list: z.array(TrendingCompanyResearch).describe("Comprehensive research on all trending companies"),
});

const inputs = { sector: process.argv[2] ?? "Technology", current_date: new Date().toISOString() };
const crew = await loadCrew("crews/stock_picker", inputs);

// Day 4: the finder and the picker remember; the researcher does not ("we want it to go and do research every time").
const MEMORY_FILE = "memory/stock_picker.json";
const past = await recall(MEMORY_FILE);
for (const name of ["trending_company_finder", "stock_picker"]) crew.agents[name]!.backstory += memoryPrompt(past);

const outputs = await runHierarchical(crew, "manager", {
  tools: { trending_company_finder: [searchTool], financial_researcher: [searchTool], stock_picker: [pushTool] },
  outputTypes: { find_trending_companies: TrendingCompanyList, research_trending_companies: TrendingCompanyResearchList },
  outputDir: "output/stock_picker",
  onEvent: consoleEvents,
});
const date = new Date().toISOString();
await remember(MEMORY_FILE, [
  { date, task: "find_trending_companies", output: outputs.find_trending_companies ?? "" },
  { date, task: "pick_best_company", output: outputs.pick_best_company ?? "" },
]);
console.log("\n\n=== FINAL DECISION ===\n\n" + outputs.pick_best_company);
