// Week 1 Day 1 — your first agentic workflow (TypeScript version of 1_foundations/1_lab1.ipynb)
// Two calls in a row: the first LLM writes a hard question, the second LLM answers it.
import type OpenAI from "openai";
import { model, openai } from "./setup.js";

// Check the key, like the notebook's cell that prints the first 8 characters
const key = process.env.OPENAI_API_KEY;
console.log(key ? `OpenAI API Key exists and begins ${key.slice(0, 8)}` : "OpenAI API Key not set");

// A list of messages in the familiar OpenAI format: role + content
let messages: OpenAI.ChatCompletionMessageParam[] = [{ role: "user", content: "What is 2+2?" }];

// And now call it
let response = await openai.chat.completions.create({ model: model("gpt-4.1-nano"), messages });
console.log(response.choices[0]!.message.content);

// Ask for a question...
const request = "Please propose a hard, challenging question to assess someone's IQ. Respond only with the question.";
messages = [{ role: "user", content: request }];
response = await openai.chat.completions.create({ model: model("gpt-4.1-mini"), messages });
const question = response.choices[0]!.message.content ?? "";
console.log(question);

// ...then ask it again: the second call answers the first call's output
messages = [{ role: "user", content: question }];
response = await openai.chat.completions.create({ model: model("gpt-4.1-mini"), messages });
const answer = response.choices[0]!.message.content ?? "";
console.log(answer);

