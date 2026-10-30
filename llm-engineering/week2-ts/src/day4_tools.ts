// Day 4 - Tools / OpenAI function-calling (TypeScript port of day4.py)
// An airline assistant (FlightAI) that can look up ticket prices. The model decides
// when it needs the tool, we run the real function, feed the result back, and let the
// model turn it into a courteous reply.
import "dotenv/config";
import { pathToFileURL } from "node:url";
import OpenAI from "openai";

export const MODEL = "gpt-4o-mini";

export const SYSTEM_MESSAGE =
  "You are a helpful assistant for an Airline called FlightAI. " +
  "Give short, courteous answers, no more than 1 sentence. " +
  "Always be accurate. If you don't know the answer, say so.";

// The "database" of ticket prices (a plain object stands in for the Python sqlite table).
const ticketPrices: Record<string, string> = {
  london: "$799",
  paris: "$899",
  tokyo: "$1400",
  berlin: "$499",
};

export function getTicketPrice(destinationCity: string): string {
  console.log(`Tool called for city ${destinationCity}`);
  const price = ticketPrices[destinationCity.toLowerCase()] ?? "Unknown ticket price";
  return `The price of a ticket to ${destinationCity} is ${price}`;
}

// The JSON schema that describes our function to the model.
export const priceFunction: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: "get_ticket_price",
    description: "Get the price of a return ticket to the destination city.",
    parameters: {
      type: "object",
      properties: {
        destination_city: {
          type: "string",
          description: "The city that the customer wants to travel to",
        },
      },
      required: ["destination_city"],
      additionalProperties: false,
    },
  },
};

export const tools: OpenAI.Chat.ChatCompletionTool[] = [priceFunction];

// Run each tool call the model requested and build the matching `tool` messages.
export function handleToolCalls(
  message: OpenAI.Chat.ChatCompletionMessage,
): OpenAI.Chat.ChatCompletionToolMessageParam[] {
  const responses: OpenAI.Chat.ChatCompletionToolMessageParam[] = [];
  for (const toolCall of message.tool_calls ?? []) {
    if (toolCall.type === "function" && toolCall.function.name === "get_ticket_price") {
      const args = JSON.parse(toolCall.function.arguments) as { destination_city: string };
      const priceDetails = getTicketPrice(args.destination_city);
      responses.push({ role: "tool", content: priceDetails, tool_call_id: toolCall.id });
    }
  }
  return responses;
}

// The full tool-call loop: ask the model; while it wants tools, run them and ask again.
export async function chat(openai: OpenAI, message: string): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_MESSAGE },
    { role: "user", content: message },
  ];
  let response = await openai.chat.completions.create({ model: MODEL, messages, tools });

  while (response.choices[0]?.finish_reason === "tool_calls") {
    const responseMessage = response.choices[0].message;
    messages.push(responseMessage);
    messages.push(...handleToolCalls(responseMessage));
    response = await openai.chat.completions.create({ model: MODEL, messages, tools });
  }
  return response.choices[0]?.message.content ?? "";
}

async function main(): Promise<void> {
  // Offline-safe sanity check: the tool runs without any network call.
  console.log(getTicketPrice("London"));
  console.log("Tool schema:", JSON.stringify(priceFunction, null, 2));

  if (!process.env.OPENAI_API_KEY) {
    console.log("\nOPENAI_API_KEY not set - skipping the live tool-call loop. See .env.example.");
    return;
  }
  const openai = new OpenAI();
  const reply = await chat(openai, "How much is a ticket to Tokyo?");
  console.log("Assistant:", reply);
}

// Only run the demo when this file is executed directly, not when imported.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
