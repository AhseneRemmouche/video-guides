// The "career conversation" chatbot of Days 4 and 5 (TypeScript version of 3_lab3, 4_lab4 and app.py).
// It plays you on your website, answers from your summary and LinkedIn PDF, records unknown questions and
// interested visitors with two tools (push notifications through Pushover), and can check its own replies
// with an evaluator model before sending them.
import { readFile } from "node:fs/promises";
import { extractText, getDocumentProxy } from "unpdf";
import type OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { compatibleClient, model, openai } from "./setup.js";

export const NAME = process.env.ME_NAME ?? "Ed Donner";

// ---------- resources: the summary and the LinkedIn profile ----------
export async function loadResources(dir = "me") {
  const pdf = await getDocumentProxy(new Uint8Array(await readFile(`${dir}/linkedin.pdf`)));
  const { text: linkedin } = await extractText(pdf, { mergePages: true });
  const summary = await readFile(`${dir}/summary.txt`, "utf-8");
  return { linkedin, summary };
}

// ---------- push notifications (Pushover) ----------
export async function push(message: string) {
  console.log(`Push: ${message}`);
  const user = process.env.PUSHOVER_USER, token = process.env.PUSHOVER_TOKEN;
  if (!user || !token) return; // no keys: just print
  await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    body: new URLSearchParams({ user, token, message }),
  });
}

// ---------- the two tools ----------
function recordUserDetails({ email, name = "Name not provided", notes = "not provided" }: { email: string; name?: string; notes?: string }) {
  return push(`Recording interest from ${name} with email ${email} and notes ${notes}`).then(() => ({ recorded: "ok" }));
}
function recordUnknownQuestion({ question }: { question: string }) {
  return push(`Recording ${question} asked that I couldn't answer`).then(() => ({ recorded: "ok" }));
}

// The JSON the model sees. Same text as the notebook.
export const tools: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "record_user_details",
      description: "Use this tool to record that a user is interested in being in touch and provided an email address",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "The email address of this user" },
          name: { type: "string", description: "The user's name, if they provided it" },
          notes: { type: "string", description: "Any additional information about the conversation that's worth recording to give context" },
        },
        required: ["email"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_unknown_question",
      description: "Always use this tool to record any question that couldn't be answered as you didn't know the answer",
      parameters: {
        type: "object",
        properties: { question: { type: "string", description: "The question that couldn't be answered" } },
        required: ["question"],
        additionalProperties: false,
      },
    },
  },
];

// A lookup table instead of an if-chain: Python's globals().get(tool_name) trick, done safely
const toolFunctions: Record<string, (args: any) => Promise<object>> = {
  record_user_details: recordUserDetails,
  record_unknown_question: recordUnknownQuestion,
};

export async function handleToolCalls(toolCalls: OpenAI.ChatCompletionMessageToolCall[]) {
  const results: OpenAI.ChatCompletionToolMessageParam[] = [];
  for (const call of toolCalls) {
    if (call.type !== "function") continue;
    console.log(`Tool called: ${call.function.name}`);
    const fn = toolFunctions[call.function.name];
    const result = fn ? await fn(JSON.parse(call.function.arguments)) : {};
    results.push({ role: "tool", content: JSON.stringify(result), tool_call_id: call.id });
  }
  return results;
}

// ---------- system prompt ----------
export function systemPrompt(summary: string, linkedin: string) {
  return (
    `You are acting as ${NAME}. You are answering questions on ${NAME}'s website, ` +
    `particularly questions related to ${NAME}'s career, background, skills and experience. ` +
    `Your responsibility is to represent ${NAME} for interactions on the website as faithfully as possible. ` +
    `You are given a summary of ${NAME}'s background and LinkedIn profile which you can use to answer questions. ` +
    `Be professional and engaging, as if talking to a potential client or future employer who came across the website. ` +
    `If you don't know the answer to any question, use your record_unknown_question tool to record the question that you couldn't answer, even if it's about something trivial or unrelated to career. ` +
    `If the user is engaging in discussion, try to steer them towards getting in touch via email; ask for their email and record it using your record_user_details tool. ` +
    `\n\n## Summary:\n${summary}\n\n## LinkedIn Profile:\n${linkedin}\n\n` +
    `With this context, please chat with the user, always staying in character as ${NAME}.`
  );
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** One chat turn with the tool loop: call the model; while it asks for tools, run them and call again. */
export async function chat(system: string, message: string, history: ChatTurn[]): Promise<string> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [{ role: "system", content: system }, ...history, { role: "user", content: message }];
  for (let turn = 0; turn < 5; turn++) { // a cap the notebook does not have: no endless tool loops
    const response = await openai.chat.completions.create({ model: model("gpt-4o-mini"), messages, tools });
    const choice = response.choices[0]!;
    if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
      messages.push(choice.message);
      messages.push(...(await handleToolCalls(choice.message.tool_calls)));
    } else {
      return choice.message.content ?? "";
    }
  }
  return "Sorry, I got stuck. Could you rephrase that?";
}

// ---------- the evaluator (Day 4) ----------
export const Evaluation = z.object({ is_acceptable: z.boolean(), feedback: z.string() });
export type Evaluation = z.infer<typeof Evaluation>;

export function evaluatorSystemPrompt(summary: string, linkedin: string) {
  return (
    `You are an evaluator that decides whether a response to a question is acceptable. ` +
    `You are provided with a conversation between a User and an Agent. Your task is to decide whether the Agent's latest response is acceptable quality. ` +
    `The Agent is playing the role of ${NAME} and is representing ${NAME} on their website. ` +
    `The Agent has been instructed to be professional and engaging, as if talking to a potential client or future employer who came across the website. ` +
    `The Agent has been provided with context on ${NAME} in the form of their summary and LinkedIn details. Here's the information:` +
    `\n\n## Summary:\n${summary}\n\n## LinkedIn Profile:\n${linkedin}\n\n` +
    `With this context, please evaluate the latest response, replying with whether the response is acceptable and your feedback.`
  );
}

const gemini = compatibleClient("https://generativelanguage.googleapis.com/v1beta/openai/", process.env.GOOGLE_API_KEY);

/** Ask a second model (Gemini in the course) to judge a reply, with a structured output. */
export async function evaluate(evaluatorSystem: string, reply: string, message: string, history: ChatTurn[]): Promise<Evaluation> {
  const user =
    `Here's the conversation between the User and the Agent: \n\n${JSON.stringify(history)}\n\n` +
    `Here's the latest message from the User: \n\n${message}\n\n` +
    `Here's the latest response from the Agent: \n\n${reply}\n\n` +
    `Please evaluate the response, replying with whether it is acceptable and your feedback.`;
  const response = await gemini.chat.completions.parse({
    model: model("gemini-2.5-flash"),
    messages: [{ role: "system", content: evaluatorSystem }, { role: "user", content: user }],
    response_format: zodResponseFormat(Evaluation, "evaluation"),
  });
  return response.choices[0]!.message.parsed ?? { is_acceptable: true, feedback: "evaluator returned nothing" };
}
