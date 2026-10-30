// Day 3 - A chat function with history + a system prompt (TypeScript port of day3.py)
// Gradio's ChatInterface gave us `chat(message, history)` for free; here we write the
// equivalent as a plain function so the React UI (and the Hono server) can reuse it.
import "dotenv/config";
import { pathToFileURL } from "node:url";
import OpenAI from "openai";

export const MODEL = "gpt-4o-mini";

export const DEFAULT_SYSTEM_MESSAGE =
  "You are a helpful assistant in a clothes store. You should try to gently encourage the " +
  "customer to try items that are on sale. Hats are 60% off, and most other items are 50% off. " +
  "For example, if the customer says 'I'm looking to buy a hat', you could reply something like, " +
  "'Wonderful - we have lots of hats - including several that are part of our sales event.' " +
  "Encourage the customer to buy hats if they are unsure what to get.\n" +
  "If the customer asks for shoes, you should respond that shoes are not on sale today, but " +
  "remind the customer to look at hats!";

export type ChatMessage = { role: "user" | "assistant"; content: string };

// Build the messages array the API expects: system prompt + prior turns + the new message.
// Like the Python lab, we tweak the system prompt on the fly when 'belt' is mentioned.
export function buildMessages(
  message: string,
  history: ChatMessage[],
  system: string = DEFAULT_SYSTEM_MESSAGE,
): OpenAI.Chat.ChatCompletionMessageParam[] {
  let relevantSystem = system;
  if (message.toLowerCase().includes("belt")) {
    relevantSystem +=
      " The store does not sell belts; if you are asked for belts, be sure to point out other items on sale.";
  }
  return [
    { role: "system", content: relevantSystem },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];
}

// Non-streaming version (returns the whole reply).
export async function chat(
  openai: OpenAI,
  message: string,
  history: ChatMessage[],
  system: string = DEFAULT_SYSTEM_MESSAGE,
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: buildMessages(message, history, system),
  });
  return response.choices[0]?.message.content ?? "";
}

// Streaming version: yields the growing reply, mirroring the Gradio `yield response` loop.
export async function* chatStream(
  openai: OpenAI,
  message: string,
  history: ChatMessage[],
  system: string = DEFAULT_SYSTEM_MESSAGE,
): AsyncGenerator<string> {
  const stream = await openai.chat.completions.create({
    model: MODEL,
    messages: buildMessages(message, history, system),
    stream: true,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta.content ?? "";
    if (delta) yield delta;
  }
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.log("OPENAI_API_KEY not set - this demo needs it. See .env.example.");
    return;
  }
  const openai = new OpenAI();
  const history: ChatMessage[] = [];
  const reply = await chat(openai, "I'm looking to buy a hat", history);
  console.log("Assistant:", reply);
}

// Only run the demo when this file is executed directly, not when imported.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
