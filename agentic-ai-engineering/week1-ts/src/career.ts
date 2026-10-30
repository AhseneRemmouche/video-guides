// The career "digital twin" - the Week 1 capstone (1_foundations__app.py).
// A chat that answers *as a person*, backed by a short bio, with two tools:
//   - record_unknown_question : logs anything it couldn't answer
//   - record_user_details     : logs a visitor who leaves an email
// Each tool fires a Pushover phone push, which is a safe no-op without keys.
// Run `tsx src/career.ts` for a CLI demo, or import `chat` from the server.
import "dotenv/config";
import { pathToFileURL } from "node:url";
import OpenAI from "openai";

export type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

const MODEL = "gpt-4o-mini";
const NAME = "Ed Donner";

// Stand-in for the summary.txt + linkedin.pdf the notebook reads from disk.
const SUMMARY =
  "Ed Donner is a technologist and entrepreneur based in New York. He co-founded Nebula.io, " +
  "where he builds and applies LLMs to help people discover their potential and pursue their " +
  "reason for being. He previously founded and sold the AI startup untapt. He is a passionate " +
  "teacher who loves helping engineers get hands-on with LLMs and autonomous agents.";

const SYSTEM_PROMPT =
  `You are acting as ${NAME}. You are answering questions on ${NAME}'s website, ` +
  `particularly questions related to ${NAME}'s career, background, skills and experience. ` +
  `Your responsibility is to represent ${NAME} for interactions on the website as faithfully as possible. ` +
  `You are given a summary of ${NAME}'s background which you can use to answer questions. ` +
  "Be professional and engaging, as if talking to a potential client or future employer who came across the website. " +
  "If you don't know the answer to any question, use your record_unknown_question tool to record the question " +
  "that you couldn't answer, even if it's about something trivial or unrelated to career. " +
  "If the user is engaging in discussion, try to steer them towards getting in touch via email; ask for their " +
  "email and record it using your record_user_details tool." +
  `\n\n## Summary:\n${SUMMARY}\n\n` +
  `With this context, please chat with the user, always staying in character as ${NAME}.`;

// Build the client lazily: `new OpenAI()` throws with no key, and callers
// (e.g. the API route) want to detect a missing key and respond cleanly.
function getClient(): OpenAI | null {
  return process.env.OPENAI_API_KEY ? new OpenAI() : null;
}

// Guarded Pushover push - prints locally, and only hits the network with keys.
async function push(message: string): Promise<void> {
  console.log(`Push: ${message}`);
  const user = process.env.PUSHOVER_USER;
  const token = process.env.PUSHOVER_TOKEN;
  if (!user || !token) return;
  try {
    await fetch("https://api.pushover.net/1/messages.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, token, message }),
    });
  } catch (err) {
    console.error("Pushover failed:", err);
  }
}

async function recordUserDetails(args: { email: string; name?: string; notes?: string }) {
  await push(
    `Recording interest from ${args.name ?? "Name not provided"} with email ${args.email} ` +
      `and notes ${args.notes ?? "not provided"}`,
  );
  return { recorded: "ok" };
}

async function recordUnknownQuestion(args: { question: string }) {
  await push(`Recording "${args.question}" asked that I couldn't answer`);
  return { recorded: "ok" };
}

const toolFunctions: Record<string, (args: any) => Promise<unknown>> = {
  record_user_details: recordUserDetails,
  record_unknown_question: recordUnknownQuestion,
};

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "record_user_details",
      description:
        "Use this tool to record that a user is interested in being in touch and provided an email address",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "The email address of this user" },
          name: { type: "string", description: "The user's name, if they provided it" },
          notes: {
            type: "string",
            description: "Any additional information about the conversation worth recording",
          },
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
      description:
        "Always use this tool to record any question that couldn't be answered as you didn't know the answer",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "The question that couldn't be answered" },
        },
        required: ["question"],
        additionalProperties: false,
      },
    },
  },
];

async function handleToolCalls(
  toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[],
): Promise<OpenAI.Chat.Completions.ChatCompletionToolMessageParam[]> {
  const results: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = [];
  for (const toolCall of toolCalls) {
    if (toolCall.type !== "function") continue;
    const toolName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments || "{}");
    console.log(`Tool called: ${toolName}`);
    const fn = toolFunctions[toolName];
    const result = fn ? await fn(args) : {};
    results.push({ role: "tool", content: JSON.stringify(result), tool_call_id: toolCall.id });
  }
  return results;
}

// The chat function. `history` is the prior turns (user/assistant messages);
// we prepend the system prompt and append the new user message, then run the
// tool-call loop until the model produces a normal text reply.
export async function chat(message: string, history: ChatMessage[] = []): Promise<string> {
  const openai = getClient();
  if (!openai) throw new Error("OPENAI_API_KEY is not set");

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: message },
  ];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await openai.chat.completions.create({ model: MODEL, messages, tools });
    const choice = response.choices[0];
    if (choice?.finish_reason === "tool_calls" && choice.message.tool_calls) {
      const results = await handleToolCalls(choice.message.tool_calls);
      messages.push(choice.message);
      messages.push(...results);
    } else {
      return choice?.message.content ?? "";
    }
  }
}

// CLI demo: `npm run career`.
async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.log("OPENAI_API_KEY not set - add it to your .env (see .env.example).");
    return;
  }
  const question = "What did you do before Nebula.io?";
  console.log("User:", question, "\n");
  console.log("Reply:\n", await chat(question));
}

// Run the demo only when executed directly, not when imported by the server.
// pathToFileURL normalizes Windows paths so this match works cross-platform.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
