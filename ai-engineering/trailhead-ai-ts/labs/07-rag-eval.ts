// Lab 07: the same 20 questions, now answered from retrieved chunks. Compare with the baseline.
import * as rag from "../src/rag.js";
import { loadChunks } from "../src/docs.js";
import { loadQa } from "../src/evalset.js";
import { loadRun, run, summary } from "../src/evaluate.js";
import { Hybrid } from "../src/retrieve.js";

const retriever = new Hybrid(loadChunks());
const rows = await run("rag_v2", loadQa(), (q) => rag.answer(q, retriever, "rag_v2"));

for (const r of rows) {
  const mark = r.keyword_pass ? "PASS" : "fail";
  console.log(`${mark}  ${r.id}  ${JSON.stringify(r.answer.slice(0, 120))}`);
}

console.log("\nbaseline:", summary(loadRun("baseline")));
console.log("rag_v2:  ", summary(rows));
