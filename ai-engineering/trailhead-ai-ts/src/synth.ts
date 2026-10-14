// Generate question-answer pairs from the documents, then filter them.
import { z } from "zod";
import { chatJson } from "./llm.js";

export const QA = z.object({ question: z.string(), answer: z.string() });
export const QAList = z.object({ pairs: z.array(QA) });
export type QA = z.infer<typeof QA>;

const genPrompt = (n: number) => `Write ${n} different questions a customer might ask that this document answers,
each with a short correct answer taken from the document. Vary the wording; some questions should be casual.
Reply with JSON: {"pairs": [{"question": "...", "answer": "..."}]}`;

export async function generate(docText: string, n = 4): Promise<QA[]> {
  const messages = [{ role: "system" as const, content: genPrompt(n) }, { role: "user" as const, content: docText }];
  return (await chatJson(messages, QAList, "QAList", undefined, { temperature: 0.8 })).pairs;
}

/** Lower case, letters, digits and single spaces only: "Do you ship?!" and "do you  ship" become equal. */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").split(" ").filter(Boolean).join(" ");
}

/** Cheap filter: every number in the answer must appear in the document. */
export function isGrounded(pair: QA, docText: string): boolean {
  return (pair.answer.match(/\d+(?:[.,]\d+)?/g) ?? []).every((num) => docText.includes(num));
}
