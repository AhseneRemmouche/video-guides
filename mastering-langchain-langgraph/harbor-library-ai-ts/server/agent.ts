// The agent behind the web app: catalog tools, a policy search tool, memory per conversation,
// and a librarian's approval before any hold is placed.
import { MemorySaver } from "@langchain/langgraph";
import { createAgent, humanInTheLoopMiddleware, tool } from "langchain";
import { z } from "zod";
import { ALL_TOOLS } from "../src/catalog.js";
import { getModel } from "../src/config.js";
import { buildVectorStore, formatDocs } from "../src/knowledge.js";

const retriever = (await buildVectorStore()).asRetriever({ k: 2 });

const searchPolicies = tool(
  async ({ question }) => formatDocs(await retriever.invoke(question)),
  {
    name: "search_policies",
    description: "Search the library's rules: cards, loans, renewals, late fees, branches and opening hours, " +
      "rooms and the maker space, Wi-Fi, printing and e-books. Returns text tagged with its source file.",
    schema: z.object({ question: z.string() }),
  },
);

export const agent = createAgent({
  model: getModel(),
  tools: [searchPolicies, ...ALL_TOOLS],
  systemPrompt: "You are Harbor City Library's assistant. Use search_policies for questions about rules, fees, " +
    "rooms and opening hours, and the catalog tools for books and member accounts. " +
    "Name the source file when you answer from a policy. Answer briefly.",
  middleware: [humanInTheLoopMiddleware({ interruptOn: { place_hold: true } })],
  checkpointer: new MemorySaver(), // one memory per conversation (thread_id), kept while the server runs
});
