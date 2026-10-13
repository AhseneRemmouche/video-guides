// Lab 12: short-term memory (keep the conversation small) and long-term memory (facts across threads).
import { AIMessage, HumanMessage, SystemMessage, trimMessages, type BaseMessage } from "@langchain/core/messages";
import { InMemoryStore, MemorySaver, MessagesAnnotation, START, StateGraph, type LangGraphRunnableConfig } from "@langchain/langgraph";
import { getModel } from "../src/config.js";

const model = getModel();

// LangChain.js has no built-in "approximate" counter, so count about 4 characters per token, plus 3 per message.
const approxTokens = (messages: BaseMessage[]) =>
  messages.reduce((n, m) => n + Math.ceil(String(m.content).length / 4) + 3, 0);

// 1. Short-term: trimMessages keeps only the most recent part of a long conversation.
const history: BaseMessage[] = [];
for (let i = 1; i <= 6; i++) {
  history.push(new HumanMessage(`Question ${i}: tell me about branch number ${i}.`), new AIMessage(`Answer ${i}: ...`));
}
const kept = await trimMessages(history, { maxTokens: 40, tokenCounter: approxTokens, strategy: "last", startOn: "human" });
console.log(`1) trimMessages: ${history.length} messages -> ${kept.length} kept:`, kept.map((m) => String(m.content).slice(0, 11)));

// 2. Long-term: a store holds facts by namespace, shared by every thread of the same member.
const store = new InMemoryStore();

async function callModel(state: typeof MessagesAnnotation.State, config: LangGraphRunnableConfig) {
  const member = config.configurable?.member_id as string;
  const namespace = ["members", member, "preferences"];
  const last = String(state.messages.at(-1)?.content);
  if (last.toLowerCase().startsWith("remember")) { // a deliberately simple rule for what to save
    await config.store!.put(namespace, `note-${(await config.store!.search(namespace)).length}`, { text: last });
  }
  const notes = (await config.store!.search(namespace)).map((item) => item.value.text);
  const system = new SystemMessage("You are Harbor City Library's assistant. Answer briefly. " +
    `What this member asked you to remember: ${notes.length ? JSON.stringify(notes) : "nothing yet"}`);
  const recent = await trimMessages(state.messages, { maxTokens: 500, tokenCounter: approxTokens, strategy: "last", startOn: "human" });
  return { messages: [await model.invoke([system, ...recent])] };
}

const graph = new StateGraph(MessagesAnnotation)
  .addNode("model", callModel)
  .addEdge(START, "model")
  .compile({ checkpointer: new MemorySaver(), store });

async function ask(thread: string, text: string) {
  const config = { configurable: { thread_id: thread, member_id: "M-1002" } };
  const result = await graph.invoke({ messages: [{ role: "user", content: text }] }, config);
  console.log(`   [${thread}] ${text}\n   -> ${result.messages.at(-1)?.content}`);
}

console.log("\n2) Long-term memory across two threads of member M-1002:");
await ask("monday", "Remember: I only read books in large print.");
await ask("friday", "Can you suggest how I should look for a new novel?");
console.log("   stored:", (await store.search(["members", "M-1002", "preferences"])).map((i) => i.value));
