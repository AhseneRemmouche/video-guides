// Lab 14: the same agent in a few lines with createAgent, plus a typed final answer and per-user context.
import type { ToolRuntime } from "@langchain/core/tools";
import { MemorySaver } from "@langchain/langgraph";
import { createAgent, providerStrategy, tool, toolStrategy } from "langchain";
import { z } from "zod";
import { MEMBERS, checkAvailability, searchCatalog } from "../src/catalog.js";
import { getModel } from "../src/config.js";
import { toolCalls } from "../src/show.js";

const Visitor = z.object({
  member_id: z.string(), // set by the application after login, never by the model
});

const myAccount = tool(
  (_input, runtime: ToolRuntime<unknown, z.infer<typeof Visitor>>) => {
    const m = MEMBERS[runtime.context.member_id]; // the id comes from the app's context, so no one can ask for another member
    return `${m.name}: loans ${JSON.stringify(m.loans)}, holds ${JSON.stringify(m.holds)}, fees ${m.fees_eur.toFixed(2)} EUR`;
  },
  {
    name: "my_account",
    description: "Show the logged-in member's own loans, holds and fees.",
    schema: z.object({}),
  },
);

const agent = createAgent({
  model: getModel(),
  tools: [searchCatalog, checkAvailability, myAccount],
  systemPrompt: "You are Harbor City Library's assistant. Use the tools. Answer briefly.",
  contextSchema: Visitor,
  checkpointer: new MemorySaver(),
});

console.log("1) Graph nodes createAgent built:", Object.keys((await agent.graph.getGraphAsync()).nodes));

const config = { configurable: { thread_id: "sam" }, context: { member_id: "M-1002" } };
for (const text of ["What do I owe, and what do I have on loan?", "Is The Little Crab Who Could on the shelf?"]) {
  const result = await agent.invoke({ messages: [{ role: "user", content: text }] }, config);
  console.log(`\n2) Q: ${text}\n   tools: ${JSON.stringify(toolCalls(result.messages).slice(-2))}\n   A: ${result.messages.at(-1)?.content}`);
}

// 3. responseFormat: the agent's last step returns a validated object instead of free text.
const Availability = z.object({
  title: z.string(),
  copies_available: z.number().int(),
  branch: z.string(),
});

console.log("\n3) responseFormat, two strategies:");
const typedAgents = {
  toolStrategy: createAgent({
    model: getModel(),
    tools: [searchCatalog, checkAvailability],
    responseFormat: toolStrategy(Availability), // the answer is one more "tool" the model must call
    systemPrompt: "Find the item with search_catalog, then check_availability.",
  }),
  providerStrategy: createAgent({
    model: getModel(),
    tools: [searchCatalog, checkAvailability],
    responseFormat: providerStrategy(Availability), // the provider's own JSON-schema mode shapes the answer
    systemPrompt: "Find the item with search_catalog, then check_availability.",
  }),
};
for (const [label, typed] of Object.entries(typedAgents)) {
  try {
    const result = await typed.invoke({ messages: [{ role: "user", content: "Is 'Build Your Own Radio' available?" }] });
    const used = toolCalls(result.messages).map(([name]) => name);
    console.log(`   ${label.padEnd(17)} tools called: ${JSON.stringify(used)}\n   ${"".padEnd(17)} structuredResponse:`, result.structuredResponse);
  } catch (error) {
    console.log(`   ${label.padEnd(17)} failed: ${(error as Error).message.slice(0, 160)}`);
  }
}
