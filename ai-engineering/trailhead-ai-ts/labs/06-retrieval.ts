// Lab 06: measure three retrievers on the questions whose source document we know.
import { loadChunks } from "../src/docs.js";
import { loadQa } from "../src/evalset.js";
import { BM25, EmbeddingIndex, Hybrid, type Retriever } from "../src/retrieve.js";

const chunks = loadChunks();
console.log(`${chunks.length} chunks from ${new Set(chunks.map((c) => c.doc)).size} documents\n`);

const questions = loadQa().filter((q) => q.source);
const retrievers: Record<string, Retriever> = {
  BM25: new BM25(chunks), Embeddings: new EmbeddingIndex(chunks), "Hybrid (RRF)": new Hybrid(chunks),
};
const K = 3;
const pct = (x: number) => `${Math.round(100 * x)}%`;

console.log(`${"retriever".padEnd(14)}${"hit@1".padStart(8)}${"hit@3".padStart(8)}${"MRR".padStart(8)}`);
const misses: Record<string, [string, string, string[]][]> = {};
for (const [name, retriever] of Object.entries(retrievers)) {
  let hit1 = 0, hit3 = 0, rr = 0;
  for (const q of questions) {
    const docs = (await retriever.search(q.question, K)).map(([chunk]) => chunk.doc);
    const rank = docs.indexOf(q.source!) + 1;
    if (rank) {
      hit1 += Number(rank === 1);
      hit3 += 1;
      rr += 1 / rank;
    } else {
      (misses[name] ??= []).push([q.id, q.question, docs]);
    }
  }
  const n = questions.length;
  console.log(`${name.padEnd(14)}${pct(hit1 / n).padStart(8)}${pct(hit3 / n).padStart(8)}${(rr / n).toFixed(2).padStart(8)}`);
}

for (const [name, rows] of Object.entries(misses)) {
  console.log(`\nMissed by ${name}:`);
  for (const [qid, question, docs] of rows) console.log(`  ${qid} ${question}  ->  ${JSON.stringify(docs)}`);
}
