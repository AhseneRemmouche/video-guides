// Day 3 (Lab 3) - the evaluator-optimizer pattern (structured outputs).
// TS port of 3_lab3.py. One model answers "as the person"; a second model
// evaluates that answer against a strict schema (is_acceptable + feedback).
// If it fails, we rerun the answer with the feedback folded into the prompt.
import "dotenv/config";
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

if (!process.env.OPENAI_API_KEY) {
  console.log("OPENAI_API_KEY not set - add it to your .env (see .env.example).");
  process.exit(0);
}

const openai = new OpenAI();

// The evaluator talks through the same client, just pointed at Gemini if a
// GOOGLE_API_KEY is present; otherwise it falls back to OpenAI.
const evaluatorClient = process.env.GOOGLE_API_KEY
  ? new OpenAI({
      apiKey: process.env.GOOGLE_API_KEY,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    })
  : openai;
const evaluatorModel = process.env.GOOGLE_API_KEY ? "gemini-2.0-flash" : "gpt-4o-mini";

const name = "Ed Donner";

// Short stand-in for the summary.txt + linkedin.pdf the notebook loads.
const summary =
  "Ed Donner is a technologist and entrepreneur. He co-founded the AI startup Nebula.io, " +
  "building LLMs that help people discover their potential, and previously founded and sold " +
  "the AI startup untapt. He loves teaching people to build with LLMs and agents.";

const systemPrompt =
  `You are acting as ${name}. You are answering questions on ${name}'s website, ` +
  `particularly questions related to ${name}'s career, background, skills and experience. ` +
  `Your responsibility is to represent ${name} for interactions on the website as faithfully as possible. ` +
  `You are given a summary of ${name}'s background which you can use to answer questions. ` +
  "Be professional and engaging, as if talking to a potential client or future employer. " +
  "If you don't know the answer, say so." +
  `\n\n## Summary:\n${summary}\n\n` +
  `With this context, please chat with the user, always staying in character as ${name}.`;

// The structured-output schema. The evaluator MUST return exactly this shape.
const Evaluation = z.object({
  is_acceptable: z.boolean(),
  feedback: z.string(),
});
type Evaluation = z.infer<typeof Evaluation>;

const evaluatorSystemPrompt =
  `You are an evaluator that decides whether a response to a question is acceptable. ` +
  `You are provided with a conversation between a User and an Agent. Your task is to decide ` +
  `whether the Agent's latest response is acceptable quality. The Agent is playing the role of ` +
  `${name} and is representing ${name} on their website. The Agent has been instructed to be ` +
  `professional and engaging. The Agent has been given this context:\n\n## Summary:\n${summary}\n\n` +
  "With this context, please evaluate the latest response, replying with whether the response " +
  "is acceptable and your feedback.";

function evaluatorUserPrompt(reply: string, message: string, history: string): string {
  return (
    `Here's the conversation between the User and the Agent:\n\n${history}\n\n` +
    `Here's the latest message from the User:\n\n${message}\n\n` +
    `Here's the latest response from the Agent:\n\n${reply}\n\n` +
    "Please evaluate the response, replying with whether it is acceptable and your feedback."
  );
}

async function evaluate(reply: string, message: string, history: string): Promise<Evaluation> {
  const response = await evaluatorClient.chat.completions.parse({
    model: evaluatorModel,
    messages: [
      { role: "system", content: evaluatorSystemPrompt },
      { role: "user", content: evaluatorUserPrompt(reply, message, history) },
    ],
    response_format: zodResponseFormat(Evaluation, "evaluation"),
  });
  return response.choices[0]?.message.parsed ?? { is_acceptable: true, feedback: "" };
}

async function rerun(reply: string, message: string, feedback: string): Promise<string> {
  const updatedSystemPrompt =
    systemPrompt +
    "\n\n## Previous answer rejected\nYou just tried to reply, but the quality control rejected your reply\n" +
    `## Your attempted answer:\n${reply}\n\n` +
    `## Reason for rejection:\n${feedback}\n\n`;
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: updatedSystemPrompt },
      { role: "user", content: message },
    ],
  });
  return response.choices[0]?.message.content ?? "";
}

async function chat(message: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ],
  });
  let reply = response.choices[0]?.message.content ?? "";

  const evaluation = await evaluate(reply, message, "");
  if (evaluation.is_acceptable) {
    console.log("Passed evaluation - returning reply");
  } else {
    console.log("Failed evaluation - retrying");
    console.log(evaluation.feedback);
    reply = await rerun(reply, message, evaluation.feedback);
  }
  return reply;
}

async function main() {
  const message = "Do you hold a patent?";
  console.log("User:", message, "\n");
  console.log("Reply:\n", await chat(message));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
