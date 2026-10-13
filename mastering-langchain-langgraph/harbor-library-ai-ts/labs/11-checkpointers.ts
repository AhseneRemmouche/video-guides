// Lab 11: checkpointers give a graph a memory per conversation (thread) and let it survive restarts.
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import type { BaseMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { buildBuilder } from "../src/agent-graph.js";
import { RUNS } from "../src/config.js";
import { toolCalls } from "../src/show.js";

type Graph = ReturnType<ReturnType<typeof buildBuilder>["compile"]>;

/** Print the tool calls and the final answer of one turn (messages from index `start` on). */
function show(messages: BaseMessage[], start: number) {
  const calls = toolCalls(messages.slice(start));
  if (calls.length) console.log("      tool call:", JSON.stringify(calls));
  console.log(`   -> ${messages.at(-1)?.content}`);
}

async function ask(graph: Graph, thread: string, text: string) {
  const config = { configurable: { thread_id: thread } };
  const before = ((await graph.getState(config)).values.messages ?? []).length;
  console.log(`   [${thread}] ${text}   (${before} earlier messages loaded)`);
  show((await graph.invoke({ messages: [{ role: "user", content: text }] }, config)).messages, before);
}

// 1. Without a checkpointer every call starts from zero.
const plain = buildBuilder().compile();
console.log("1) No checkpointer:");
for (const text of ["Hi, I'm Lea, member M-1001.", "What is my member id?"]) {
  console.log(`   ${text}`);
  show((await plain.invoke({ messages: [{ role: "user", content: text }] })).messages, 0);
}

// 2. With a checkpointer, each thread_id keeps its own history.
const graph = buildBuilder().compile({ checkpointer: new MemorySaver() });
console.log("\n2) MemorySaver, two threads:");
await ask(graph, "lea", "Hi, I'm Lea, member M-1001.");
await ask(graph, "lea", "What is my member id?");
await ask(graph, "sam", "What is my member id?");

// 3. The saved state: messages so far and the checkpoints that led there.
const config = { configurable: { thread_id: "lea" } };
const state = await graph.getState(config);
let checkpoints = 0;
for await (const _ of graph.getStateHistory(config)) checkpoints++;
console.log(`\n3) Thread 'lea' has ${state.values.messages.length} messages and ${checkpoints} checkpoints; ` +
  `next node: ${state.next.length ? state.next : "none (finished)"}`);

// 4. SqliteSaver writes checkpoints to a file, so a new process (or a restart) can continue the thread.
mkdirSync(RUNS, { recursive: true });
const dbPath = path.join(RUNS, "checkpoints.sqlite");
rmSync(dbPath, { force: true });
console.log("\n4) SqliteSaver:");
const first = SqliteSaver.fromConnString(dbPath);
await ask(buildBuilder().compile({ checkpointer: first }), "ines", "Hello, I'm Ines, member M-1003. I love cooking books.");
first.db.close();
const second = SqliteSaver.fromConnString(dbPath); // a fresh connection, as after a restart
await ask(buildBuilder().compile({ checkpointer: second }), "ines", "Which genre do I like?");
let rows = 0;
for await (const _ of second.list({ configurable: { thread_id: "ines" } })) rows++;
console.log(`   ${rows} checkpoints stored for thread 'ines' in ${path.basename(dbPath)}`);
second.db.close();
