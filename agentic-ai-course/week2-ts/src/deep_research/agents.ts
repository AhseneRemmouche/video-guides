// The four agents of the deep-research app (TypeScript version of 2_openai/deep_research/*_agent.py)
import { Agent, tool, webSearchTool } from "@openai/agents";
import { z } from "zod";
import { LOCAL, MODEL, sendEmail } from "../setup.js";

export const HOW_MANY_SEARCHES = Number(process.env.HOW_MANY_SEARCHES ?? 3);

// ---------- search agent ----------
const SEARCH_INSTRUCTIONS =
  "You are a research assistant. Given a search term, you search the web for that term and " +
  "produce a concise summary of the results. The summary must 2-3 paragraphs and less than 300 " +
  "words. Capture the main points. Write succintly, no need to have complete sentences or good " +
  "grammar. This will be consumed by someone synthesizing a report, so its vital you capture the " +
  "essence and ignore any fluff. Do not include any additional commentary other than the summary itself.";

// OpenAI's hosted web search only exists on OpenAI's own API. In local mode a function tool stands in for it
// with canned text, so the whole pipeline (plan → search in parallel → write → email) still runs offline.
const localSearch = tool({
  name: "web_search",
  description: "Search the web for the query and return a short summary of the results (offline stand-in).",
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    console.log(`[web_search stand-in] ${query}`);
    return (
      "Search results (canned, offline test data): several open-source agent frameworks were widely discussed in 2025: " +
      "OpenAI Agents SDK (lightweight, handoffs, guardrails, tracing), CrewAI (role-based crews of agents with tasks), " +
      "LangGraph (graph-based state machines with checkpointing), Microsoft AutoGen (AgentChat and Core layers, " +
      "distributed runtime) and the Model Context Protocol (MCP) for connecting tools. Articles compared ease of use, " +
      "control flow, observability and production readiness."
    );
  },
});

export const searchAgent = new Agent({
  name: "Search agent",
  instructions: SEARCH_INSTRUCTIONS,
  tools: [LOCAL ? localSearch : webSearchTool({ searchContextSize: "low" })],
  model: MODEL,
  modelSettings: { toolChoice: "required" },
});

// ---------- planner agent (structured output) ----------
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
    "You are a helpful research assistant. Given a query, come up with a set of web searches " +
    `to perform to best answer the query. Output ${HOW_MANY_SEARCHES} terms to query for.`,
  model: MODEL,
  outputType: WebSearchPlan,
});

// ---------- writer agent (structured output) ----------
export const ReportData = z.object({
  short_summary: z.string().describe("A short 2-3 sentence summary of the findings."),
  markdown_report: z.string().describe("The final report"),
  follow_up_questions: z.array(z.string()).describe("Suggested topics to research further"),
});
export type ReportData = z.infer<typeof ReportData>;

export const writerAgent = new Agent({
  name: "WriterAgent",
  instructions:
    "You are a senior researcher tasked with writing a cohesive report for a research query. " +
    "You will be provided with the original query, and some initial research done by a research assistant.\n" +
    "You should first come up with an outline for the report that describes the structure and " +
    "flow of the report. Then, generate the report and return that as your final output.\n" +
    "The final output should be in markdown format, and it should be lengthy and detailed. Aim " +
    "for 5-10 pages of content, at least 1000 words.",
  model: MODEL,
  outputType: ReportData,
});

// ---------- email agent (function tool) ----------
const sendEmailTool = tool({
  name: "send_email",
  description: "Send an email with the given subject and HTML body",
  parameters: z.object({ subject: z.string(), html_body: z.string() }),
  execute: async ({ subject, html_body }) => sendEmail(subject, html_body, "text/html"),
});

export const emailAgent = new Agent({
  name: "Email agent",
  instructions:
    "You are able to send a nicely formatted HTML email based on a detailed report.\n" +
    "You will be provided with a detailed report. You should use your tool to send one email, providing the " +
    "report converted into clean, well presented HTML with an appropriate subject line.",
  tools: [sendEmailTool],
  model: MODEL,
});
