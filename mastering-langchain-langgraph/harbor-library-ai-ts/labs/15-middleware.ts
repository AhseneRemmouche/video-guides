// Lab 15: middleware: hooks that run around every model and tool call of a createAgent agent.
import { Command, MemorySaver } from "@langchain/langgraph";
import {
  createAgent, createMiddleware, humanInTheLoopMiddleware, modelCallLimitMiddleware, piiMiddleware,
  type HITLRequest,
} from "langchain";
import { ALL_TOOLS, MEMBERS } from "../src/catalog.js";
import { getModel } from "../src/config.js";

/** A custom hook: print what the model is about to see. Returning nothing changes nothing. */
const logCalls = createMiddleware({
  name: "LogCalls",
  beforeModel: (state) => {
    const last = state.messages.at(-1);
    console.log(`      [beforeModel] ${state.messages.length} messages, last from ${last?.type}: ${JSON.stringify(String(last?.content).slice(0, 60))}`);
  },
});

const agent = createAgent({
  model: getModel(),
  tools: ALL_TOOLS,
  systemPrompt: "You are Harbor City Library's assistant. Use the tools. Answer briefly.",
  middleware: [
    logCalls,
    piiMiddleware("email", { strategy: "redact" }), // emails never reach the model
    modelCallLimitMiddleware({ runLimit: 4, exitBehavior: "end" }), // stop runaway loops
    humanInTheLoopMiddleware({ interruptOn: { place_hold: true } }), // a person approves every hold
  ],
  checkpointer: new MemorySaver(),
});

console.log("1) PII redaction + logging:");
let r = await agent.invoke(
  { messages: [{ role: "user", content: "My email is sam.okoro@example.com. Is item B006 available?" }] },
  { configurable: { thread_id: "a" } },
);
console.log("   the model saw:", JSON.stringify(r.messages[0].content));
console.log("   answer:", r.messages.at(-1)?.content);

console.log("\n2) Human in the loop for place_hold:");
const config = { configurable: { thread_id: "b" } };
const holdsBefore = [...MEMBERS["M-1002"].holds];
r = await agent.invoke({ messages: [{ role: "user", content: "I'm member M-1002, please place a hold on B010." }] }, config);
if (r.__interrupt__) {
  const request = r.__interrupt__[0].value as HITLRequest;
  console.log("   paused for review:", JSON.stringify(request.actionRequests.map((a) => [a.name, a.args])));
  r = await agent.invoke(
    // In LangChain.js the message becomes the tool result word for word, so say what happened.
    new Command({ resume: { decisions: [{ type: "reject", message: "A librarian rejected this hold: holds on B010 are paused this week." }] } }),
    config,
  );
}
console.log("   after the decision:", r.messages.at(-1)?.content);
// Check the data, not the words: did place_hold actually run?
console.log(`   holds before: ${JSON.stringify(holdsBefore)}, after: ${JSON.stringify(MEMBERS["M-1002"].holds)}`);
