// Day 4 - The illusion of memory (TypeScript port of day4_memory.py)
// Every call to an LLM is stateless: it remembers nothing between calls. We create
// the feeling of memory by sending the whole conversation back every time.
import "dotenv/config";
import OpenAI from "openai";

const openai = new OpenAI();
const MODEL = "gpt-4o-mini";

// First call: we tell it our name.
let messages: OpenAI.ChatCompletionMessageParam[] = [
  { role: "system", content: "You are a helpful assistant" },
  { role: "user", content: "Hi! I'm Ed!" },
];
let response = await openai.chat.completions.create({ model: MODEL, messages });
console.log(response.choices[0]?.message.content);

// Second call, on its own: it has no idea who we are - the first call is forgotten.
messages = [
  { role: "system", content: "You are a helpful assistant" },
  { role: "user", content: "What's my name?" },
];
response = await openai.chat.completions.create({ model: MODEL, messages });
console.log(response.choices[0]?.message.content);

// Fix: replay the whole conversation, including the assistant's earlier reply.
messages = [
  { role: "system", content: "You are a helpful assistant" },
  { role: "user", content: "Hi! I'm Ed!" },
  { role: "assistant", content: "Hi Ed! How can I assist you today?" },
  { role: "user", content: "What's my name?" },
];
response = await openai.chat.completions.create({ model: MODEL, messages });
console.log(response.choices[0]?.message.content);
