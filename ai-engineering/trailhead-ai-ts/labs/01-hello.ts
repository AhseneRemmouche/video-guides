// Lab 01: your first call to a model, and what it cost.
import * as config from "../src/config.js";
import { chat } from "../src/llm.js";

console.log(`Server: ${config.BASE_URL}   Model: ${config.MODEL}\n`);

const reply = await chat([
  { role: "system", content: "You are a helpful assistant. Answer in one sentence." },
  { role: "user", content: "What is an e-bike?" },
]);

console.log(reply.text);
console.log(`\n${reply.inputTokens} input tokens, ${reply.outputTokens} output tokens, ${reply.seconds.toFixed(1)} s`);
