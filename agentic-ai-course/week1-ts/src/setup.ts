// Shared setup: environment variables, the OpenAI client, model names and an optional local-model mode.
//
// Default (like the course): OPENAI_API_KEY in .env.
// Local mode (no OpenAI key): OPENAI_BASE_URL=http://localhost:11434/v1 OPENAI_API_KEY=ollama MODEL=llama3.2
// Every model name used by the labs is then replaced by MODEL, and every provider points at the same Ollama server.
import "dotenv/config";
import OpenAI from "openai";

export const LOCAL = Boolean(process.env.OPENAI_BASE_URL);

/** The model to use: the course's model name, or MODEL in local mode. */
export function model(courseModel: string): string {
  return LOCAL ? (process.env.MODEL ?? "llama3.2") : courseModel;
}

/** An OpenAI client. new OpenAI() reads OPENAI_API_KEY and OPENAI_BASE_URL from the environment. */
export const openai = new OpenAI();

/** A client for another provider's OpenAI-compatible endpoint (in local mode: the same Ollama server). */
export function compatibleClient(baseURL: string, apiKey: string | undefined): OpenAI {
  return LOCAL ? new OpenAI({ baseURL: process.env.OPENAI_BASE_URL, apiKey: "ollama" }) : new OpenAI({ baseURL, apiKey });
}
