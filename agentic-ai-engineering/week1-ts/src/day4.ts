// Day 4 (Lab 4) - tools and the tool-call loop.
// TS port of 4_lab4.py. The model is given two "tools" (plain functions
// described as JSON schemas). When it decides to call one, we run it, feed the
// result back, and loop until the model is done. This is the heart of an agent.
import "dotenv/config";
import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  console.log("OPENAI_API_KEY not set - add it to your .env (see .env.example).");
  process.exit(0);
}

const openai = new OpenAI();

// A phone push via Pushover - a no-op unless both keys are present.
async function push(message: string): Promise<void> {
  console.log(`Push: ${message}`);
  const user = process.env.PUSHOVER_USER;
  const token = process.env.PUSHOVER_TOKEN;
  if (!user || !token) return;
  await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, token, message }),
  });
}

// The two tool implementations. They just record something and push a note.
async function recordUserDetails(args: { email: string; name?: string; notes?: string }) {
  await push(
    `Recording interest from ${args.name ?? "Name not provided"} with email ${args.email} ` +
      `and notes ${args.notes ?? "not provided"}`,
  );
  return { recorded: "ok" };
}

async function recordUnknownQuestion(args: { question: string }) {
  await push(`Recording ${args.question} asked that I couldn't answer`);
  return { recorded: "ok" };
}

// A lookup table instead of lab4's "big IF statement" / globals() trick.
const toolFunctions: Record<string, (args: any) => Promise<unknown>> = {
  record_user_details: recordUserDetails,
  record_unknown_question: recordUnknownQuestion,
};

// The JSON-schema descriptions the model sees.
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

// Run each tool call the model asked for and return the "tool" result messages.
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
    results.push({
      role: "tool",
      content: JSON.stringify(result),
      tool_call_id: toolCall.id,
    });
  }
  return results;
}

async function main() {
  // Force a tool call so the loop is visible even without a real conversation.
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You are a helpful assistant. If a question cannot be answered, you MUST call the " +
        "record_unknown_question tool with that question.",
    },
    { role: "user", content: "What is the capital of the fictional planet Zorblax-9?" },
  ];

  let done = false;
  while (!done) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools,
    });
    const choice = response.choices[0];
    if (choice?.finish_reason === "tool_calls" && choice.message.tool_calls) {
      const results = await handleToolCalls(choice.message.tool_calls);
      messages.push(choice.message);
      messages.push(...results);
    } else {
      console.log("\nFinal reply:\n", choice?.message.content);
      done = true;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
