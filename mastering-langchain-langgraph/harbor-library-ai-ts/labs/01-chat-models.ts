// Lab 01: talk to a chat model through LangChain: invoke, messages, stream, batch.
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { initChatModel } from "langchain";
import { MODEL, NUM_CTX, getModel } from "../src/config.js";

const model = getModel();

// 1. The simplest call: a string in, an AIMessage out.
const reply = await model.invoke("What is a public library? Answer in one sentence.");
console.log("1) invoke:", reply.content);
console.log("   usage:", reply.usage_metadata);

// 2. A list of messages: the system message sets the role, the human message asks.
const messages = [
  new SystemMessage("You are the assistant of Harbor City Library. Be brief and friendly."),
  new HumanMessage("Hi! Can you help me find a book about the sea?"),
];
console.log("\n2) with a system message:", (await model.invoke(messages)).content);

// 3. Streaming: print each piece as soon as it arrives.
process.stdout.write("\n3) stream: ");
for await (const chunk of await model.stream("Name three things people can do in a library, as a comma-separated list.")) {
  process.stdout.write(`${chunk.content}|`);
}
console.log();

// 4. Batch: several independent prompts in one call (sent concurrently).
const answers = await model.batch(["Translate 'library' into French.", "Translate 'library' into Spanish."]);
console.log("\n4) batch:", answers.map((a) => a.content));

// 5. The same model through the provider-agnostic factory: only the string changes per provider.
const same = await initChatModel(`ollama:${MODEL}`, { temperature: 0, numCtx: NUM_CTX });
console.log("\n5) initChatModel:", same.constructor.name, "->", (await same.invoke("Say 'ready' and nothing else.")).content);
