// The API behind the React chat page (Day 3 + Day 4, served over HTTP).
//   POST /api/chat  {message, history, system?}  -> streamed assistant reply (Day 3 chatbot)
//   POST /api/price {message}                    -> {reply} using the Day 4 tool-call loop
// Reads OPENAI_API_KEY from the environment; with no key it returns a clear 400 JSON error.
import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { streamText } from "hono/streaming";
import { z } from "zod";
import OpenAI from "openai";
import { chatStream, DEFAULT_SYSTEM_MESSAGE, type ChatMessage } from "../src/day3_chatbot.js";
import { chat as toolChat } from "../src/day4_tools.js";

// Build the client lazily: constructing OpenAI with no key throws, and we want a 400 instead.
function getClient(): OpenAI | null {
  return process.env.OPENAI_API_KEY ? new OpenAI() : null;
}

const chatBody = z.object({
  message: z.string().min(1),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .default([]),
  system: z.string().optional(),
});
const priceBody = z.object({ message: z.string().min(1) });

const app = new Hono();

// --- Day 3: streaming chat with history + system prompt -----------------------
app.post("/api/chat", async (c) => {
  const openai = getClient();
  if (!openai) return c.json({ error: "OPENAI_API_KEY is not set on the server" }, 400);

  const parsed = chatBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Body must be { message, history?, system? }" }, 400);

  const { message, history, system } = parsed.data;
  return streamText(c, async (stream) => {
    const gen = chatStream(openai, message, history as ChatMessage[], system ?? DEFAULT_SYSTEM_MESSAGE);
    for await (const delta of gen) {
      await stream.write(delta);
    }
  });
});

// --- Day 4: airline tool-call loop (returns the final reply as JSON) ----------
app.post("/api/price", async (c) => {
  const openai = getClient();
  if (!openai) return c.json({ error: "OPENAI_API_KEY is not set on the server" }, 400);

  const parsed = priceBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Body must be { message: string }" }, 400);

  const reply = await toolChat(openai, parsed.data.message);
  return c.json({ reply });
});

// Serve the built React app (run `npm run build` first).
app.use("/*", serveStatic({ root: "./web/dist" }));

const port = Number(process.env.PORT ?? 8788);
serve({ fetch: app.fetch, port });
console.log(`LLM Engineering Week 2 API on http://localhost:${port}`);
