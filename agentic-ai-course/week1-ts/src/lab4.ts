// Week 1 Day 5 — tools: the chatbot records unknown questions and interested visitors (TypeScript version of 4_lab4.ipynb)
import { chat, loadResources, push, systemPrompt, type ChatTurn } from "./career.js";

await push("HEY!!"); // the notebook's first test of Pushover

const { summary, linkedin } = await loadResources();
const system = systemPrompt(summary, linkedin);

const history: ChatTurn[] = [];
for (const q of [
  "Hi! Where are you from and what do you do?",
  "Do you hold a patent?",
  "Great, I'd like to stay in touch. My email is sam@example.com and my name is Sam.",
]) {
  console.log(`\nUSER: ${q}`);
  const reply = await chat(system, q, history);
  console.log(`BOT: ${reply}`);
  history.push({ role: "user", content: q }, { role: "assistant", content: reply });
}
