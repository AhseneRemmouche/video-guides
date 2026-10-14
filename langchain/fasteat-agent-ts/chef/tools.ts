import "dotenv/config";
import { TavilySearch } from "@langchain/tavily";
import { tool } from "langchain";
import { z } from "zod";
import { log } from "../src/logger.js";

// Tavily's LangChain.js tool. Without a key it would throw, so we only create it when there is one.
const tavily = process.env.TAVILY_API_KEY ? new TavilySearch({ maxResults: 5 }) : undefined;

export const webSearch = tool(
  async ({ query }) => {
    log.info(`searching for ${query}`);
    if (!tavily) {
      return "Web search is not configured (no TAVILY_API_KEY). Answer from what you already know.";
    }
    // On a failed search, TavilySearch returns { error: "..." } instead of throwing.
    return JSON.stringify(await tavily.invoke({ query }));
  },
  {
    name: "web_search",
    description: "Search the web for recipes and cooking information. Use short, specific queries.",
    schema: z.object({ query: z.string().describe("What to search for") }),
  },
);
