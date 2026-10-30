// Day 1 (Lab 1) - your first LLM call, then a two-step plan -> act workflow.
// TS port of 1_lab1.py. Load the key, confirm it, make a simple call, then
// chain two calls: the model proposes a hard question (plan) and answers it (act).
import "dotenv/config";
import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

// The equivalent of the notebook's "does the key exist?" sanity check.
if (!apiKey) {
  console.log("OPENAI_API_KEY not set - add it to your .env (see .env.example).");
  process.exit(0);
}
console.log(`OpenAI API Key exists and begins ${apiKey.slice(0, 8)}`);

// new OpenAI() reads OPENAI_API_KEY from the environment automatically.
const openai = new OpenAI();

async function main() {
  // A first, trivial call - "the hello world" of LLM engineering.
  const first = await openai.chat.completions.create({
    model: "gpt-4.1-nano",
    messages: [{ role: "user", content: "What is 2+2?" }],
  });
  console.log("\n2+2 =", first.choices[0]?.message.content);

  // --- Step 1: PLAN -----------------------------------------------------------
  // Ask a stronger model to invent a hard IQ-style question for us.
  const planPrompt =
    "Please propose a hard, challenging question to assess someone's IQ. " +
    "Respond only with the question.";
  const planResponse = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: planPrompt }],
  });
  const question = planResponse.choices[0]?.message.content ?? "";
  console.log("\nProposed question:\n", question);

  // --- Step 2: ACT ------------------------------------------------------------
  // Feed that question straight back in as the next prompt - this hand-off of
  // one call's output into the next is the core of a chained workflow.
  const actResponse = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: question }],
  });
  const answer = actResponse.choices[0]?.message.content ?? "";
  console.log("\nAnswer:\n", answer);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
