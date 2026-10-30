// Day 5 - Multimodal (TypeScript port of day5.py)
// artist(): generate an image with DALL-E 3 (images.generate)
// talker(): turn text into speech with TTS (audio.speech)
// combined agent: the Day 4 tool-call loop, then draw the destination and speak the reply.
// Everything is guarded so the module compiles and imports without an API key.
import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import OpenAI from "openai";
import { getTicketPrice, tools, SYSTEM_MESSAGE } from "./day4_tools.js";

export const IMAGE_MODEL = "dall-e-3";
export const TTS_MODEL = "tts-1";
export const CHAT_MODEL = "gpt-4o-mini";

// Generate an image and return the raw PNG bytes (b64 decoded).
export async function artist(openai: OpenAI, city: string): Promise<Buffer> {
  const response = await openai.images.generate({
    model: IMAGE_MODEL,
    prompt:
      `An image representing a vacation in ${city}, showing tourist spots and everything ` +
      `unique about ${city}, in a vibrant pop-art style`,
    size: "1024x1024",
    n: 1,
    response_format: "b64_json",
  });
  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned");
  return Buffer.from(b64, "base64");
}

// Turn text into speech and return the raw audio bytes (MP3).
export async function talker(openai: OpenAI, message: string): Promise<Buffer> {
  const response = await openai.audio.speech.create({
    model: TTS_MODEL,
    voice: "onyx", // try alloy or coral too
    input: message,
  });
  return Buffer.from(await response.arrayBuffer());
}

// The combined agent: run the airline tool-call loop, then (optionally) draw + speak.
export async function multimodalChat(
  openai: OpenAI,
  message: string,
): Promise<{ reply: string; image: Buffer | null; audio: Buffer }> {
  // Detect which city the tools looked at so we know what to draw, without re-running them.
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_MESSAGE },
    { role: "user", content: message },
  ];
  let response = await openai.chat.completions.create({ model: CHAT_MODEL, messages, tools });
  const cities: string[] = [];

  while (response.choices[0]?.finish_reason === "tool_calls") {
    const responseMessage = response.choices[0].message;
    messages.push(responseMessage);
    for (const toolCall of responseMessage.tool_calls ?? []) {
      if (toolCall.type === "function" && toolCall.function.name === "get_ticket_price") {
        const args = JSON.parse(toolCall.function.arguments) as { destination_city: string };
        cities.push(args.destination_city);
        messages.push({
          role: "tool",
          content: getTicketPrice(args.destination_city),
          tool_call_id: toolCall.id,
        });
      }
    }
    response = await openai.chat.completions.create({ model: CHAT_MODEL, messages, tools });
  }

  const reply = response.choices[0]?.message.content ?? "";
  const audio = await talker(openai, reply);
  const image = cities.length > 0 ? await artist(openai, cities[0]!) : null;
  return { reply, image, audio };
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.log("OPENAI_API_KEY not set - skipping the live DALL-E / TTS calls. See .env.example.");
    console.log(`Would use image model '${IMAGE_MODEL}' and TTS model '${TTS_MODEL}'.`);
    // The Day 4 tool still works offline via its own guard.
    return;
  }
  const openai = new OpenAI();
  const { reply, image, audio } = await multimodalChat(openai, "How much is a ticket to Tokyo?");
  console.log("Assistant:", reply);
  await writeFile("day5-reply.mp3", audio);
  console.log("Wrote day5-reply.mp3");
  if (image) {
    await writeFile("day5-city.png", image);
    console.log("Wrote day5-city.png");
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
