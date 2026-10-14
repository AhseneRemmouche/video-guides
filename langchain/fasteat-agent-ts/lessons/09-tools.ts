import "dotenv/config";
import { TavilySearch } from "@langchain/tavily";
import { createAgent, HumanMessage, tool } from "langchain";
import { z } from "zod";
import { getModel } from "../src/models.js";

// Tavily's LangChain.js tool. Without a key it would throw, so we only create it when there is one.
const tavily = process.env.TAVILY_API_KEY ? new TavilySearch() : undefined;

const webSearch = tool(
  async ({ query }) => {
    console.log(`we are doing some research on ${query}`);
    if (!tavily) return "Web search is not configured (no TAVILY_API_KEY).";
    return JSON.stringify(await tavily.invoke({ query }));
  },
  {
    name: "web_search",
    description: "tool for searching the web for information",
    schema: z.object({ query: z.string() }),
  },
);

const agent = createAgent({
  model: getModel(),
  tools: [webSearch],
});

const response = await agent.invoke({
  messages: [new HumanMessage("give me the lastest news of the day")],
});

console.log("this is the AI last response: ");
console.log(response.messages.at(-1)?.text);

console.log("--------------- this is the details -----------------");
console.log(response.messages);
