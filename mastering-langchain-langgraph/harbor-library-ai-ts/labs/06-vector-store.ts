// Lab 06: embed chunks, store them, and search by meaning.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { RUNS, getEmbeddings } from "../src/config.js";
import { loadPolicies, split } from "../src/knowledge.js";

const embeddings = getEmbeddings();

// 1. An embedding is a list of numbers; similar texts get similar lists.
const vector = await embeddings.embedQuery("When does the library open?");
console.log(`1) one embedding: ${vector.length} numbers, starting ${JSON.stringify(vector.slice(0, 4).map((x) => +x.toFixed(3)))}`);

// 2. Build the store: every chunk is embedded once.
const chunks = await split(await loadPolicies());
const store = await MemoryVectorStore.fromDocuments(chunks, embeddings);
console.log(`\n2) stored ${chunks.length} chunks`);

// 3. Similarity search with scores (cosine similarity: higher is closer).
for (const question of ["How much do I pay if a book is late?", "Is there Wi-Fi?", "Can I make things with a laser?"]) {
  console.log(`\n3) ${question}`);
  for (const [doc, score] of await store.similaritySearchWithScore(question, 2)) {
    console.log(`   ${score.toFixed(3)}  ${path.basename(doc.metadata.source).padEnd(13)} ${JSON.stringify(doc.pageContent.slice(0, 70))}`);
  }
}

// 4. Filter on metadata: search only inside one file.
const onlyBranches = await store.similaritySearch("open on Sunday", 2, (d) => d.metadata.source.endsWith("branches.md"));
console.log("\n4) filtered to branches.md:", onlyBranches.map((d) => d.pageContent.slice(0, 50)));

// 5. Save to disk and load it back without re-embedding. The vectors are plain arrays, so JSON is enough.
mkdirSync(RUNS, { recursive: true });
const file = path.join(RUNS, "policies_store.json");
writeFileSync(file, JSON.stringify(store.memoryVectors));
const again = new MemoryVectorStore(embeddings);
again.memoryVectors = JSON.parse(readFileSync(file, "utf-8"));
console.log("\n5) reloaded store answers:", (await again.similaritySearch("printing price", 1))[0].pageContent.slice(0, 60));
