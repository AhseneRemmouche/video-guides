// Lab 05: grade answers with an AI judge, then check the judge against human labels.
import path from "node:path";
import * as config from "../src/config.js";
import { EVALS } from "../src/config.js";
import { loadJsonl, loadQa } from "../src/evalset.js";
import { keywordPass } from "../src/evaluate.js";
import { judge } from "../src/judge.js";

interface Labelled { id: string; question: string; answer: string; human_correct: boolean }

const qa = new Map(loadQa().map((q) => [q.id, q]));
const labelled = loadJsonl<Labelled>(path.join(EVALS, "judge_calibration.jsonl"));
console.log(`Judge model: ${config.JUDGE_MODEL}\n`);

const pct = (a: number, n: number) => `${Math.round((100 * a) / n)}%`;
let agreeJudge = 0;
let agreeKeyword = 0;
for (const row of labelled) {
  const q = qa.get(row.id)!;
  const v = await judge(row.question, row.answer, q.source);
  const judgeOk = v.verdict === "correct";
  const keywordOk = keywordPass(q, row.answer);
  agreeJudge += Number(judgeOk === row.human_correct);
  agreeKeyword += Number(keywordOk === row.human_correct);
  const flag = judgeOk === row.human_correct ? "" : "   <-- judge disagrees with human";
  const ok = (b: boolean) => (b ? "ok " : "bad");
  console.log(`${row.id}  human=${ok(row.human_correct)}  judge=${ok(judgeOk)}  keyword=${ok(keywordOk)}${flag}`);
  if (flag) console.log(`      judge said: ${v.reasoning.slice(0, 160)}`);
}

const n = labelled.length;
console.log(`\nAgreement with human labels: judge ${agreeJudge}/${n} = ${pct(agreeJudge, n)}, keyword check ${agreeKeyword}/${n} = ${pct(agreeKeyword, n)}`);
