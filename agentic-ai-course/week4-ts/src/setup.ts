// Shared setup for every lab: environment variables, the chat model, and an optional local-model mode.
//
// Default (like the course): OPENAI_API_KEY in .env and gpt-4o-mini.
// Local mode (no OpenAI key): set OPENAI_BASE_URL=http://localhost:11434/v1 OPENAI_API_KEY=ollama MODEL=llama3.2
// ChatOpenAI then talks to Ollama's OpenAI-compatible endpoint instead of api.openai.com.
import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";

export const MODEL = process.env.MODEL ?? "gpt-4o-mini";
export const LOCAL = Boolean(process.env.OPENAI_BASE_URL);

// LangSmith tracing (Day 3) is switched on by LANGSMITH_TRACING=true in .env. Without a LangSmith key it can only fail,
// so turn it off explicitly and keep the console clean.
if (!process.env.LANGSMITH_API_KEY) {
  process.env.LANGSMITH_TRACING = "false";
  process.env.LANGCHAIN_TRACING_V2 = "false";
}

/** The TypeScript twin of Python's ChatOpenAI(model="gpt-4o-mini"). */
export function makeLLM() {
  return new ChatOpenAI({
    model: MODEL,
    // baseURL is how the OpenAI client is pointed at another server (here: Ollama on this machine)
    ...(LOCAL && { configuration: { baseURL: process.env.OPENAI_BASE_URL }, apiKey: process.env.OPENAI_API_KEY ?? "ollama" }),
  });
}
