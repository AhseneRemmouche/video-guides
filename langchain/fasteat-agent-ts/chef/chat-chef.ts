import "dotenv/config";
import { createInterface } from "node:readline";
import { MemorySaver } from "@langchain/langgraph";
import { AIMessageChunk, createAgent, HumanMessage } from "langchain";
import { getVisionModel } from "../src/models.js";
import { buildImageMessage, chooseImageFile } from "./photo-decoder.js";
import { CHEF_PROMPT, SYSTEM_CHEF_PROMPT } from "./prompt.js";
import { webSearch } from "./tools.js";

const agent = createAgent({
  model: getVisionModel(),
  tools: [webSearch],
  systemPrompt: SYSTEM_CHEF_PROMPT,
  checkpointer: new MemorySaver(),
});

const config = { configurable: { thread_id: "kitchen-1" } };

/** Send one message to the chef and print the answer as it streams in. */
async function ask(message: HumanMessage) {
  const stream = await agent.stream({ messages: [message] }, { ...config, streamMode: "messages" });
  for await (const [token, metadata] of stream) {
    // Tool results pass through this stream too: print only what the model writes.
    if (AIMessageChunk.isInstance(token) && token.text) {
      process.stdout.write(token.text);
    }
  }
  process.stdout.write("\n\n");
}

const imagePath = process.argv[2] ?? (await chooseImageFile());
await ask(buildImageMessage(imagePath, CHEF_PROMPT));

const terminal = createInterface({ input: process.stdin, output: process.stdout, prompt: "You (q to quit): " });
// When the input ends (Ctrl+Z / Ctrl+D, or the end of a piped file) readline closes; prompt() must not run after that.
let closed = false;
terminal.on("close", () => (closed = true));
terminal.prompt();
for await (const line of terminal) { // one line each time you press Enter; lines typed while the chef answers wait
  const question = line.trim();
  if (["q", "quit", "exit"].includes(question.toLowerCase())) {
    break;
  }
  if (question) {
    await ask(new HumanMessage(question));
  }
  if (!closed) terminal.prompt();
}
terminal.close();
