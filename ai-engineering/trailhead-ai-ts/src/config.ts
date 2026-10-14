// Settings read from environment variables (or a .env file), with defaults for a local Ollama server.
import "dotenv/config";
import path from "node:path";
import type { ReasoningEffort } from "openai/resources/shared";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const DATA = path.join(ROOT, "data");
export const EVALS = path.join(ROOT, "evals");
export const PROMPTS = path.join(ROOT, "prompts");
export const RUNS = path.join(ROOT, "runs");

const env = process.env;
export const BASE_URL = env.AIE_BASE_URL ?? "http://localhost:11434/v1";
export const API_KEY = env.AIE_API_KEY ?? "ollama";
export const MODEL = env.AIE_MODEL ?? "llama3.2";
export const JUDGE_MODEL = env.AIE_JUDGE_MODEL ?? "gemma4";
export const EMBED_MODEL = env.AIE_EMBED_MODEL ?? "nomic-embed-text";
// Thinking models (gemma4, gpt-5...) spend extra hidden tokens before answering. "none" turns that off where supported.
export const REASONING_EFFORT = (env.AIE_REASONING_EFFORT ?? "none") as ReasoningEffort;
