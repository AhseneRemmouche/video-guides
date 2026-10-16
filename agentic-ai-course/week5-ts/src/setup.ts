// Shared setup for every lab: environment variables, the model to use, and an optional local-model mode.
//
// AutoGen has no JavaScript version. The AgentChat labs (Days 1-2) are ported to the OpenAI Agents SDK for JavaScript,
// whose Agent + run() play the part of AutoGen's AssistantAgent + on_messages().
//
// Default (like the course): OPENAI_API_KEY in .env and gpt-4o-mini.
// Local mode (no OpenAI key): set OPENAI_BASE_URL=http://localhost:11434/v1 OPENAI_API_KEY=ollama MODEL=llama3.2
// The SDK then talks Chat Completions to Ollama's OpenAI-compatible endpoint and tracing is switched off,
// because traces can only be uploaded to OpenAI with a real key.
import "dotenv/config";
import OpenAI from "openai";
import { OpenAIChatCompletionsModel, setDefaultOpenAIClient, setOpenAIAPI, setTracingDisabled } from "@openai/agents";

export const MODEL = process.env.MODEL ?? "gpt-4o-mini";
export const LOCAL = Boolean(process.env.OPENAI_BASE_URL);

if (LOCAL) {
  setDefaultOpenAIClient(new OpenAI({ baseURL: process.env.OPENAI_BASE_URL, apiKey: process.env.OPENAI_API_KEY ?? "ollama" }));
  setOpenAIAPI("chat_completions");
  setTracingDisabled(true);
}

/** The TypeScript twin of Python's OllamaChatCompletionClient(model="llama3.2"):
 *  a Chat Completions model pointed at the Ollama server on this machine, whatever the default model is. */
export function ollamaModel(model = process.env.OLLAMA_MODEL ?? "llama3.2") {
  const client = new OpenAI({ baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1", apiKey: "ollama" });
  return new OpenAIChatCompletionsModel(client, model);
}
