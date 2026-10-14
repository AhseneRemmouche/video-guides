// Answer a question with or without retrieved context.
import { readFileSync } from "node:fs";
import path from "node:path";
import { PROMPTS } from "./config.js";
import { chat, type Reply } from "./llm.js";
import type { Result, Retriever } from "./retrieve.js";

export function loadPrompt(name: string): string {
  return readFileSync(path.join(PROMPTS, `${name}.txt`), "utf8").replaceAll("\r\n", "\n");
}

export function formatContext(results: Result[]): string {
  return results.map(([chunk]) => `[${chunk.id}]\n${chunk.text}`).join("\n\n");
}

export interface Answer {
  answer: string;
  chunks: string[];
  reply: Reply;
}

/** Without a retriever, the model answers from memory. */
export async function answer(question: string, retriever?: Retriever, prompt = "rag_v2", k = 3, model?: string): Promise<Answer> {
  const results = retriever ? await retriever.search(question, k) : [];
  const template = loadPrompt(prompt);
  const system = retriever ? template.replace("{context}", formatContext(results)) : template;
  const reply = await chat([{ role: "system", content: system }, { role: "user", content: question }], model, { temperature: 0 });
  return { answer: reply.text, chunks: results.map(([chunk]) => chunk.id), reply };
}
