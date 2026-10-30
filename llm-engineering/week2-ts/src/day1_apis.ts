// Day 1 - Multiple APIs (TypeScript port of day1.py)
//   1) OpenAI via the openai client library
//   2) Anthropic Claude via the native @anthropic-ai/sdk
//   3) Google Gemini via the OpenAI-compatible base URL (the library's whole trick:
//      swap baseURL + apiKey and the same client talks to another provider)
//   4) a streaming helper
//   5) a short adversarial conversation between two models (argumentative GPT vs polite Claude)
//
// Run with: npm run day1   (needs OPENAI_API_KEY; ANTHROPIC_API_KEY / GOOGLE_API_KEY are optional)
import "dotenv/config";
import { pathToFileURL } from "node:url";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

const GPT_MODEL = "gpt-4o-mini";
const CLAUDE_MODEL = "claude-3-5-sonnet-20240620";
const CLAUDE_HAIKU = "claude-3-haiku-20240307";
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

// --- clients (built lazily so the module imports fine with no keys) ------------
function openaiClient(): OpenAI {
  return new OpenAI(); // reads OPENAI_API_KEY
}

function anthropicClient(): Anthropic {
  return new Anthropic(); // reads ANTHROPIC_API_KEY
}

function geminiClient(): OpenAI {
  return new OpenAI({ baseURL: GEMINI_BASE_URL, apiKey: process.env.GOOGLE_API_KEY });
}

// --- 1. OpenAI ----------------------------------------------------------------
async function askOpenAI(prompt: string): Promise<string> {
  const openai = openaiClient();
  const response = await openai.chat.completions.create({
    model: GPT_MODEL,
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0]?.message.content ?? "";
}

// --- 2. Anthropic Claude (native SDK) -----------------------------------------
// The native SDK differs from OpenAI's shape: max_tokens is required and the reply
// comes back as an array of content blocks, so we pull the text out of the text blocks.
async function askClaude(prompt: string): Promise<string> {
  const anthropic = anthropicClient();
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });
  return response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
}

// --- 3. Google Gemini via the OpenAI-compatible endpoint ----------------------
async function askGemini(prompt: string): Promise<string> {
  const gemini = geminiClient();
  const response = await gemini.chat.completions.create({
    model: GEMINI_MODEL,
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0]?.message.content ?? "";
}

// --- 4. A streaming helper ----------------------------------------------------
// Streams an OpenAI completion, writing deltas to stdout as they arrive, and
// returns the full text once the stream ends.
async function streamOpenAI(prompt: string): Promise<string> {
  const openai = openaiClient();
  const stream = await openai.chat.completions.create({
    model: GPT_MODEL,
    messages: [{ role: "user", content: prompt }],
    stream: true,
  });
  let full = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta.content ?? "";
    full += delta;
    process.stdout.write(delta);
  }
  process.stdout.write("\n");
  return full;
}

// --- 5. Adversarial two-model conversation ------------------------------------
// GPT is instructed to be argumentative; Claude to be polite. Each turn we rebuild
// the running transcript from each model's point of view (its own replies are the
// assistant turns, the other model's replies are the user turns).
const gptSystem =
  "You are a chatbot who is very argumentative; you disagree with anything in the " +
  "conversation and you challenge everything, in a snarky way.";
const claudeSystem =
  "You are a very polite, courteous chatbot. You try to agree with everything the other " +
  "person says, or find common ground. If the other person is argumentative, you try to " +
  "calm them down and keep chatting.";

async function callGpt(gptMessages: string[], claudeMessages: string[]): Promise<string> {
  const openai = openaiClient();
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: gptSystem },
  ];
  for (let i = 0; i < gptMessages.length; i++) {
    messages.push({ role: "assistant", content: gptMessages[i]! });
    if (claudeMessages[i] !== undefined) messages.push({ role: "user", content: claudeMessages[i]! });
  }
  const response = await openai.chat.completions.create({ model: GPT_MODEL, messages });
  return response.choices[0]?.message.content ?? "";
}

async function callClaude(gptMessages: string[], claudeMessages: string[]): Promise<string> {
  const anthropic = anthropicClient();
  // Claude's native SDK keeps the system prompt as a top-level field, not a message.
  const messages: Anthropic.MessageParam[] = [];
  for (let i = 0; i < gptMessages.length; i++) {
    messages.push({ role: "user", content: gptMessages[i]! });
    if (claudeMessages[i] !== undefined) messages.push({ role: "assistant", content: claudeMessages[i]! });
  }
  const response = await anthropic.messages.create({
    model: CLAUDE_HAIKU,
    max_tokens: 500,
    system: claudeSystem,
    messages,
  });
  return response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

async function adversarialLoop(rounds = 3): Promise<void> {
  const gptMessages = ["Hi there"];
  const claudeMessages = ["Hi"];
  console.log(`GPT:\n${gptMessages[0]}\n`);
  console.log(`Claude:\n${claudeMessages[0]}\n`);
  for (let i = 0; i < rounds; i++) {
    const gptNext = await callGpt(gptMessages, claudeMessages);
    console.log(`GPT:\n${gptNext}\n`);
    gptMessages.push(gptNext);

    const claudeNext = await callClaude(gptMessages, claudeMessages);
    console.log(`Claude:\n${claudeNext}\n`);
    claudeMessages.push(claudeNext);
  }
}

// --- entry point --------------------------------------------------------------
async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.log("OPENAI_API_KEY not set - this demo needs it. See .env.example.");
    return;
  }
  const joke = "Tell a joke for a student on the journey to becoming an expert in LLM Engineering";

  console.log("=== OpenAI ===");
  console.log(await askOpenAI(joke));

  if (process.env.ANTHROPIC_API_KEY) {
    console.log("\n=== Claude ===");
    console.log(await askClaude(joke));
  } else {
    console.log("\n(Skipping Claude - ANTHROPIC_API_KEY not set)");
  }

  if (process.env.GOOGLE_API_KEY) {
    console.log("\n=== Gemini ===");
    console.log(await askGemini(joke));
  } else {
    console.log("\n(Skipping Gemini - GOOGLE_API_KEY not set)");
  }

  console.log("\n=== Streaming ===");
  await streamOpenAI("Describe the color blue to someone who has never seen, in one sentence.");

  if (process.env.ANTHROPIC_API_KEY) {
    console.log("\n=== Adversarial conversation (GPT vs Claude) ===");
    await adversarialLoop(3);
  } else {
    console.log("\n(Skipping adversarial loop - needs ANTHROPIC_API_KEY)");
  }
}

// Only run when invoked directly (so the file is safe to import for its helpers).
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

export { askOpenAI, askClaude, askGemini, streamOpenAI, callGpt, callClaude, adversarialLoop };
