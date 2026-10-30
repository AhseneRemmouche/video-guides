// The API behind the React career-chat page.
//   POST /api/career {message, history} -> {reply}
// `history` is the prior turns in OpenAI message format. With no OPENAI_API_KEY
// set, the route returns a clear 400 JSON error instead of crashing.
import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { z } from "zod";
import { chat, type ChatMessage } from "../src/career.js";

// Only the two conversational roles are accepted from the client; the server
// adds the system prompt itself inside career.chat().
const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const careerBody = z.object({
  message: z.string().min(1),
  history: z.array(messageSchema).optional(),
});

const app = new Hono();

app.post("/api/career", async (c) => {
  if (!process.env.OPENAI_API_KEY) {
    return c.json({ error: "OPENAI_API_KEY is not set on the server" }, 400);
  }

  const parsed = careerBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: "Body must be { message: string, history?: {role, content}[] }" }, 400);
  }

  try {
    const history = (parsed.data.history ?? []) as ChatMessage[];
    const reply = await chat(parsed.data.message, history);
    return c.json({ reply });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// Serve the built React app (run `npm run build` first).
app.use("/*", serveStatic({ root: "./web/dist" }));

const port = Number(process.env.PORT ?? 8788);
serve({ fetch: app.fetch, port });
console.log(`Agentic AI Week 1 career API on http://localhost:${port}`);
