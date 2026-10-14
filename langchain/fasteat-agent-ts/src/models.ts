// One place that decides which model every lesson and the chef use.
// MODEL_PROVIDER=openai (default, like the course) or MODEL_PROVIDER=ollama (free, runs on your computer).
import "dotenv/config";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";

export const PROVIDER = process.env.MODEL_PROVIDER === "ollama" ? "ollama" : "openai";

export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-5-nano";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";
// llama3.2 cannot see images; gemma4 can (vision, tools and thinking).
export const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL ?? "gemma4";

// The same model as a "provider:model" string, for initChatModel and createAgent({ model: "..." }).
export const MODEL_ID = PROVIDER === "openai" ? OPENAI_MODEL : `ollama:${OLLAMA_MODEL}`;

type ModelOptions = { temperature?: number };

function ollama(model: string, options: ModelOptions) {
  // numCtx keeps the context window small enough for an ordinary GPU, numPredict caps the answer length
  // (2048 tokens: room for a full recipe),
  // think: false turns off the hidden "thinking" of models such as gemma4 (much faster).
  return new ChatOllama({ model, temperature: 0, numCtx: 8192, numPredict: 2048, think: false, ...options });
}

/** The chat model for text. Pass { temperature } to change it (OpenAI documents only the default, 1, for gpt-5 models). */
export function getModel(options: ModelOptions = {}) {
  if (PROVIDER === "ollama") return ollama(OLLAMA_MODEL, options);
  return new ChatOpenAI({ model: OPENAI_MODEL, ...options });
}

/** The chat model for photos. On OpenAI it is the same model; on Ollama it must be a vision model. */
export function getVisionModel(options: ModelOptions = {}) {
  if (PROVIDER === "ollama") return ollama(OLLAMA_VISION_MODEL, options);
  return getModel(options);
}
