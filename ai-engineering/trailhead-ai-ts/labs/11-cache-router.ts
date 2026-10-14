// Lab 11: save time and money with caches and a router.
import * as rag from "../src/rag.js";
import { ExactCache, SemanticCache } from "../src/cache.js";
import { loadChunks } from "../src/docs.js";
import { Hybrid } from "../src/retrieve.js";
import { route } from "../src/router.js";

const retriever = new Hybrid(loadChunks());
const exact = new ExactCache();
const semantic = new SemanticCache(0.9);
const elapsed = (start: number) => (performance.now() - start) / 1000;

async function answer(question: string): Promise<[text: string, source: string, seconds: number]> {
  const start = performance.now();
  const hit = exact.get(question);
  if (hit !== undefined) return [hit, "exact cache", elapsed(start)];
  const [similar, similarity] = await semantic.get(question);
  if (similar !== undefined) return [similar, `semantic cache (similarity ${similarity.toFixed(2)})`, elapsed(start)];
  const text = (await rag.answer(question, retriever)).answer;
  exact.put(question, text);
  await semantic.put(question, text);
  return [text, `model (closest cached question: ${similarity.toFixed(2)})`, elapsed(start)];
}

console.log("1) Caching");
for (const q of [
  "How long does standard shipping take?",
  "How long does standard shipping take?",
  "how long does standard shipping take",
  "How many days does standard delivery take?",
  "How long does express shipping take?",
]) {
  const [, source, seconds] = await answer(q);
  console.log(`   ${seconds.toFixed(2).padStart(6)} s  ${source.padEnd(40)} ${q}`);
}
console.log("   Careful: a semantic cache must not answer the express question with the standard answer.");

console.log("\n2) Routing");
const REPLIES: Record<string, string> = {
  smalltalk: "You're welcome! Anything else I can help with?",
  out_of_scope: "I can only help with Trailhead Bikes questions.",
};
for (const m of ["Thanks a lot!", "Do you ship to Belgium?", "Where is my order TH-10260?", "Write me a poem about cats"]) {
  const start = performance.now();
  const r = await route(m);
  const note = REPLIES[r] ?? (r === "policy_question" ? "-> RAG bot" : "-> agent with order tools");
  console.log(`   ${r.padEnd(16)} ${elapsed(start).toFixed(1).padStart(5)} s  ${JSON.stringify(m)}: ${note}`);
}
