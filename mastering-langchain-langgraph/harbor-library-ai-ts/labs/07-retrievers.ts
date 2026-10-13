// Lab 07: compare retrievers on 12 questions, then answer with a RAG chain.
import { readFileSync } from "node:fs";
import path from "node:path";
import { EnsembleRetriever } from "@langchain/classic/retrievers/ensemble";
import { MultiQueryRetriever } from "@langchain/classic/retrievers/multi_query";
import { BM25Retriever } from "@langchain/community/retrievers/bm25";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { BaseRetrieverInterface } from "@langchain/core/retrievers";
import { RunnableLambda, RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import { ROOT, getModel } from "../src/config.js";
import { buildVectorStore, formatDocs, loadPolicies, split } from "../src/knowledge.js";

const chunks = await split(await loadPolicies());
const store = await buildVectorStore(chunks);
const questions: { question: string; source: string }[] = readFileSync(path.join(ROOT, "evals", "questions.jsonl"), "utf-8")
  .trim().split("\n").map((line) => JSON.parse(line));

const dense = store.asRetriever({ k: 2 });
const mmr = store.asRetriever({ k: 2, searchType: "mmr", searchKwargs: { fetchK: 6 } });
const bm25 = BM25Retriever.fromDocuments(chunks, { k: 2 });
const hybrid = new EnsembleRetriever({ retrievers: [bm25, dense], weights: [0.5, 0.5] });
const multi = MultiQueryRetriever.fromLLM({ retriever: dense, llm: getModel() });

console.log("1) Did the right file come back in the results?");
const retrievers: [string, BaseRetrieverInterface][] =
  [["vector", dense], ["MMR", mmr], ["BM25", bm25], ["hybrid", hybrid], ["multi-query", multi]];
for (const [name, retriever] of retrievers) {
  let hits = 0;
  const misses: string[] = [];
  for (const q of questions) {
    const files = new Set((await retriever.invoke(q.question)).map((d) => path.basename(d.metadata.source)));
    if (files.has(q.source)) hits++;
    else misses.push(q.question);
  }
  console.log(`   ${name.padEnd(12)} ${hits}/${questions.length}   missed: ${JSON.stringify(misses)}`);
}

// Multi-query asks the model for other phrasings of the question. A callback shows what the model wrote.
console.log("\n   The phrasings multi-query generated for 'What is the Wi-Fi password?':");
await multi.invoke("What is the Wi-Fi password?", {
  callbacks: [{ handleLLMEnd: (output) => console.log(`   ${output.generations[0][0].text.trim().replaceAll("\n", "\n   ")}`) }],
});

// 2. A RAG chain: retrieve -> fill the prompt -> model -> string.
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You answer questions about Harbor City Library using only the context below. " +
    "If the context does not contain the answer, say you don't know. " +
    "End with the source file in brackets.\n\nContext:\n{context}"],
  ["human", "{question}"],
]);
const rag = RunnableSequence.from([
  { context: hybrid.pipe(RunnableLambda.from(formatDocs)), question: new RunnablePassthrough() },
  prompt,
  getModel(),
  new StringOutputParser(),
]);

console.log("\n2) RAG answers");
for (const q of [...questions.slice(0, 4), { question: "Can I bring my dog to the library?" }]) {
  console.log(`   Q: ${q.question}\n   A: ${await rag.invoke(q.question)}`);
}
