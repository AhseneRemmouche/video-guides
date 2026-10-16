// Week 1 Day 4 — the chatbot plus an evaluator that can reject a reply (TypeScript version of 1_foundations/3_lab3.ipynb)
// The lab's "pig latin" trick forces a bad reply so you can watch the evaluator catch it and the rerun fix it.
import type OpenAI from "openai";
import { NAME, evaluate, evaluatorSystemPrompt, loadResources, type ChatTurn } from "./career.js";
import { model, openai } from "./setup.js";

const { summary, linkedin } = await loadResources();
const system =
  `You are acting as ${NAME}. You are answering questions on ${NAME}'s website, ` +
  `particularly questions related to ${NAME}'s career, background, skills and experience. ` +
  `Your responsibility is to represent ${NAME} for interactions on the website as faithfully as possible. ` +
  `You are given a summary of ${NAME}'s background and LinkedIn profile which you can use to answer questions. ` +
  `Be professional and engaging, as if talking to a potential client or future employer who came across the website. ` +
  `If you don't know the answer, say so.` +
  `\n\n## Summary:\n${summary}\n\n## LinkedIn Profile:\n${linkedin}\n\n` +
  `With this context, please chat with the user, always staying in character as ${NAME}.`;
const evaluatorSystem = evaluatorSystemPrompt(summary, linkedin);

async function complete(messages: OpenAI.ChatCompletionMessageParam[]) {
  const r = await openai.chat.completions.create({ model: model("gpt-4o-mini"), messages });
  return r.choices[0]!.message.content ?? "";
}

/** Retry with the rejected answer and the reason in the system prompt. */
async function rerun(reply: string, message: string, history: ChatTurn[], feedback: string) {
  const updated =
    system +
    "\n\n## Previous answer rejected\nYou just tried to reply, but the quality control rejected your reply\n" +
    `## Your attempted answer:\n${reply}\n\n## Reason for rejection:\n${feedback}\n\n`;
  return complete([{ role: "system", content: updated }, ...history, { role: "user", content: message }]);
}

/** A chat turn that is evaluated before it is returned. "patent" triggers a deliberately bad pig-latin reply. */
async function chat(message: string, history: ChatTurn[]) {
  const sys = message.includes("patent")
    ? system + "\n\nEverything in your reply needs to be in pig latin - it is mandatory that you respond only and entirely in pig latin"
    : system;
  let reply = await complete([{ role: "system", content: sys }, ...history, { role: "user", content: message }]);
  const evaluation = await evaluate(evaluatorSystem, reply, message, history);
  if (evaluation.is_acceptable) {
    console.log("Passed evaluation - returning reply");
  } else {
    console.log("Failed evaluation - retrying");
    console.log(evaluation.feedback);
    reply = await rerun(reply, message, history, evaluation.feedback);
  }
  return reply;
}

for (const q of ["Where are you from?", "do you hold a patent?"]) {
  console.log(`\nUSER: ${q}`);
  console.log(`BOT: ${await chat(q, [])}`);
}
