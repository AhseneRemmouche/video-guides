// Lab 13: pause for a human before a write action, go back in time, and stream.
import { AIMessage, HumanMessage, isAIMessage } from "@langchain/core/messages";
import { Command, END, MemorySaver, MessagesAnnotation, START, StateGraph, interrupt, isInterrupted, type StateSnapshot } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SYSTEM } from "../src/agent-graph.js";
import { ALL_TOOLS } from "../src/catalog.js";
import { getModel } from "../src/config.js";

const model = getModel().bindTools(ALL_TOOLS);
type State = typeof MessagesAnnotation.State;

async function callModel(state: State) {
  return { messages: [await model.invoke([SYSTEM, ...state.messages])] };
}

/** Pause before any place_hold call and ask a librarian. Other tools run without asking. */
function approve(state: State) {
  const last = state.messages.at(-1);
  const holds = last && isAIMessage(last) ? (last.tool_calls ?? []).filter((c) => c.name === "place_hold") : [];
  if (holds.length) {
    const decision = interrupt({ question: "Approve this hold?", calls: holds });
    if (decision !== "yes") {
      const refused = new AIMessage("A librarian did not approve this hold, so I did not place it.");
      return new Command({ goto: END, update: { messages: [refused] } });
    }
  }
  return new Command({ goto: "tools" });
}

function route(state: State) {
  const last = state.messages.at(-1);
  return last && isAIMessage(last) && last.tool_calls?.length ? "approve" : END;
}

const graph = new StateGraph(MessagesAnnotation)
  .addNode("model", callModel)
  .addNode("approve", approve, { ends: ["tools", END] }) // a node that returns Command lists where it may go
  .addNode("tools", new ToolNode(ALL_TOOLS))
  .addEdge(START, "model")
  .addConditionalEdges("model", route, ["approve", END])
  .addEdge("tools", "model")
  .compile({ checkpointer: new MemorySaver() });

// 1. Human in the loop: the run stops at interrupt() and waits.
const config = { configurable: { thread_id: "hold-1" } };
const request = "I'm member M-1002. Please place a hold on item B003 for me.";
let result = await graph.invoke({ messages: [{ role: "user", content: request }] }, config);
console.log("1) Paused:", isInterrupted(result));
if (isInterrupted(result)) {
  console.log("   waiting for:", JSON.stringify(result.__interrupt__[0].value));
  console.log("   next node:", (await graph.getState(config)).next);
  result = await graph.invoke(new Command({ resume: "yes" }), config); // the librarian approves
  console.log("   after 'yes':", result.messages.at(-1)?.content);
}

// 2. The same request, refused.
const config2 = { configurable: { thread_id: "hold-2" } };
result = await graph.invoke({ messages: [{ role: "user", content: request }] }, config2);
if (isInterrupted(result)) {
  console.log("   after 'no': ", (await graph.invoke(new Command({ resume: "no" }), config2)).messages.at(-1)?.content);
}

// 3. Time travel: list the checkpoints of thread hold-1 and replay from an earlier one with a changed message.
const history: StateSnapshot[] = [];
for await (const snap of graph.getStateHistory(config)) history.push(snap);
console.log(`\n3) Thread hold-1 has ${history.length} checkpoints (newest first):`);
for (const snap of history) {
  console.log(`   step ${String(snap.metadata?.step).padStart(2)}  next=${JSON.stringify(snap.next)}  messages=${(snap.values.messages ?? []).length}`);
}
const firstInput = history.find((s) => s.next.length === 1 && s.next[0] === "model" && s.values.messages?.length === 1)!;
const original = firstInput.values.messages[0];
// Reusing the message id REPLACES that message; a message without its id would be appended instead.
const edited = new HumanMessage({ content: "I'm member M-1002. Is item B006 available?", id: original.id });
const fork = await graph.updateState(firstInput.config, { messages: [edited] });
const replayed = await graph.invoke(null, fork);
console.log("   forked run answered:", replayed.messages.at(-1)?.content);
let count = 0;
for await (const _ of graph.getStateHistory(config)) count++;
console.log(`   the thread now has ${count} checkpoints; the old branch is still there`);

// 4. Streaming: 'messages' mode yields the model's tokens as they are generated.
process.stdout.write("\n4) streamMode 'messages': ");
const stream = await graph.stream(
  { messages: [{ role: "user", content: "In one sentence, what can I do at the maker space?" }] },
  { configurable: { thread_id: "stream" }, streamMode: "messages" },
);
for await (const [token, meta] of stream) {
  if (meta.langgraph_node === "model" && token.content) process.stdout.write(String(token.content));
}
console.log();
