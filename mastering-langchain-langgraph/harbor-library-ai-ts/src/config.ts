// One place that decides which models the labs use.
import "dotenv/config";
import path from "node:path";
import { ChatOllama, OllamaEmbeddings, type ChatOllamaInput } from "@langchain/ollama";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const DATA = path.join(ROOT, "data");
export const RUNS = path.join(ROOT, "runs");

export const MODEL = process.env.HARBOR_MODEL ?? "llama3.2";
export const EMBED_MODEL = process.env.HARBOR_EMBED_MODEL ?? "nomic-embed-text";
// Ollama's default context window can be far larger than a small GPU holds; 8192 tokens is plenty for these labs.
export const NUM_CTX = Number(process.env.HARBOR_NUM_CTX ?? 8192);

/**
 * The chat model every lab uses. Change HARBOR_MODEL to try another Ollama model.
 *
 * numPredict caps the answer length, so a model that never stops can't block the server.
 * think: false turns off the hidden "thinking" of models such as gemma4 (much faster here).
 */
export function getModel(options: Partial<ChatOllamaInput> = {}) {
  return new ChatOllama({ model: MODEL, temperature: 0, numCtx: NUM_CTX, numPredict: 512, think: false, ...options });
}

export function getEmbeddings() {
  return new OllamaEmbeddings({ model: EMBED_MODEL });
}
