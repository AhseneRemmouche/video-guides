// One place that decides which chat model every graph uses.
// "dotenv/config" reads the .env file as soon as this file is imported, so a plain
// `pnpm graph 4` finds the key too (not only the LangGraph dev server).
import "dotenv/config";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";

/**
 * MODEL_PROVIDER=openai (the default, like the course) needs OPENAI_API_KEY.
 * MODEL_PROVIDER=ollama runs a local model instead: no key, no cost.
 */
export function getModel() {
  if (process.env.MODEL_PROVIDER === "ollama") {
    // numPredict caps the answer length; think: false turns off the hidden "thinking" of some models.
    return new ChatOllama({ model: process.env.OLLAMA_MODEL ?? "llama3.2", temperature: 0, numCtx: 8192, numPredict: 512, think: false });
  }
  return new ChatOpenAI({ model: process.env.OPENAI_MODEL ?? "gpt-4o" });
}
