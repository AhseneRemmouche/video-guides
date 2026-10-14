// An AI judge: a (usually stronger) model grades an answer against the reference document.
import { z } from "zod";
import * as config from "./config.js";
import { loadDocs } from "./docs.js";
import { chatJson } from "./llm.js";

const RUBRIC = `You grade answers from a bike shop's support assistant.

You get the customer's question, the shop's reference document and the assistant's answer.
The answer is CORRECT when:
- it answers the question the way the reference document does, and
- it states no number, policy or fact that contradicts or is missing from the reference.
If the reference says no document covers the question, the answer is CORRECT only if it says it doesn't know
or points to support, without inventing facts.
Extra politeness or advice that adds no new facts is fine.

First explain your reasoning in two or three sentences, then give the verdict.`;

export const Verdict = z.object({
  reasoning: z.string(),
  verdict: z.enum(["correct", "incorrect"]),
});

export async function judge(question: string, answer: string, source: string | null) {
  const reference = source ? loadDocs()[source] : "No document covers this question.";
  const prompt = `QUESTION:\n${question}\n\nREFERENCE DOCUMENT:\n${reference}\n\nASSISTANT'S ANSWER:\n${answer}`;
  return chatJson(
    [{ role: "system", content: RUBRIC }, { role: "user", content: prompt }],
    Verdict, "Verdict", config.JUDGE_MODEL, { temperature: 0 },
  );
}
