// Lab 04: score the bot before it knows anything about the shop. This is the number to beat.
import * as rag from "../src/rag.js";
import { loadQa } from "../src/evalset.js";
import { run, summary } from "../src/evaluate.js";

const questions = loadQa();
const rows = await run("baseline", questions, (q) => rag.answer(q, undefined, "baseline"));

for (const r of rows) {
  const mark = r.keyword_pass ? "PASS" : "fail";
  console.log(`${mark}  ${r.id}  ${r.question}\n      ${JSON.stringify(r.answer.slice(0, 110))}`);
}
console.log("\n", summary(rows));
