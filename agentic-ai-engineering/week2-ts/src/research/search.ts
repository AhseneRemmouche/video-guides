// The search agent (TypeScript port of 2_openai/deep_research/search_agent.py).
//
// The course uses OpenAI's hosted WebSearchTool, which only runs on OpenAI's own API. To keep this port
// compiling and runnable without hosted tools, the search agent is given a CANNED function web-search tool
// instead: it returns deterministic, offline text so the whole pipeline (plan -> search -> write -> email)
// works the same way end to end.
import { Agent, tool } from "@openai/agents";
import { z } from "zod";
import { MODEL } from "../setup.js";

const INSTRUCTIONS =
  "You are a research assistant. Given a search term, you use the web_search tool to look it up and then " +
  "produce a concise summary of the results. The summary must be 2-3 paragraphs and less than 300 words. " +
  "Capture the main points. Write succinctly, no need to have complete sentences or good grammar. This will " +
  "be consumed by someone synthesizing a report, so it is vital you capture the essence and ignore any fluff. " +
  "Do not include any additional commentary other than the summary itself.";

// A canned, offline stand-in for OpenAI's hosted WebSearchTool. It compiles with no hosted-tool dependency
// and returns deterministic text, so searches never hit the network.
const webSearch = tool({
  name: "web_search",
  description: "Search the web for the given query and return a short summary of the results.",
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    console.log(`[web_search canned stand-in] ${query}`);
    return (
      `Canned offline search results for "${query}": several open-source agent frameworks were widely ` +
      "discussed in 2025 - the OpenAI Agents SDK (lightweight, with handoffs, guardrails and tracing), " +
      "CrewAI (role-based crews of agents with tasks), LangGraph (graph-based state machines with " +
      "checkpointing), Microsoft AutoGen (AgentChat and Core layers, distributed runtime) and the Model " +
      "Context Protocol (MCP) for connecting tools. Articles compared ease of use, control flow, " +
      "observability and production readiness."
    );
  },
});

export const searchAgent = new Agent({
  name: "Search agent",
  instructions: INSTRUCTIONS,
  tools: [webSearch],
  model: MODEL,
  modelSettings: { toolChoice: "required" },
});
