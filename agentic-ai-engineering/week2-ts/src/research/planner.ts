// The planner agent (TypeScript port of 2_openai/deep_research/planner_agent.py).
// Structured output: given a query, it returns a typed plan of web searches to run.
import { Agent } from "@openai/agents";
import { z } from "zod";
import { MODEL } from "../setup.js";

export const HOW_MANY_SEARCHES = Number(process.env.HOW_MANY_SEARCHES ?? 3);

export const WebSearchItem = z.object({
  reason: z.string().describe("Your reasoning for why this search is important to the query."),
  query: z.string().describe("The search term to use for the web search."),
});
export const WebSearchPlan = z.object({
  searches: z.array(WebSearchItem).describe("A list of web searches to perform to best answer the query."),
});
export type WebSearchItem = z.infer<typeof WebSearchItem>;
export type WebSearchPlan = z.infer<typeof WebSearchPlan>;

export const plannerAgent = new Agent({
  name: "PlannerAgent",
  instructions:
    "You are a helpful research assistant. Given a query, come up with a set of web searches to perform to " +
    `best answer the query. Output ${HOW_MANY_SEARCHES} terms to query for.`,
  model: MODEL,
  outputType: WebSearchPlan,
});
