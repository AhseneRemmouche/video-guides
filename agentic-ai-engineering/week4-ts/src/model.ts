// Shared model setup for every day of Week 4 (TypeScript / LangGraph.js).
//
// The course uses OpenAI's hosted gpt-4o-mini. To run locally with no API key and no
// cost, we point LangChain's ChatOpenAI at Ollama's OpenAI-compatible endpoint
// (http://localhost:11434/v1). The base URL and model can be overridden with env vars.
import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";

// Where the model lives. Defaults to the local Ollama server.
export const BASE_URL = process.env.OPENAI_BASE_URL ?? "http://localhost:11434/v1";
export const MODEL = process.env.MODEL ?? "llama3.2";
export const API_KEY = process.env.OPENAI_API_KEY ?? "ollama"; // Ollama ignores the value.

/** Build a ChatOpenAI talking to Ollama's OpenAI-compatible API. */
export function makeLlm(temperature = 0): ChatOpenAI {
  return new ChatOpenAI({
    model: MODEL,
    temperature,
    apiKey: API_KEY,
    configuration: { baseURL: BASE_URL },
  });
}
