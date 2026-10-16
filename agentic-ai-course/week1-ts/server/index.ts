// The career-conversation API behind the React chat (replaces gr.ChatInterface(me.chat) from app.py)
// POST /api/chat {message, history} → {reply}
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { chat, loadResources, systemPrompt, NAME, type ChatTurn } from "../src/career.js";

const { summary, linkedin } = await loadResources(); // read once at start-up, like Me.__init__
const system = systemPrompt(summary, linkedin);

const app = new Hono();

app.get("/api/me", (c) => c.json({ name: NAME }));

app.post("/api/chat", async (c) => {
  const { message, history } = await c.req.json<{ message: string; history: ChatTurn[] }>();
  if (!message?.trim()) return c.json({ error: "message is required" }, 400);
  // keep only role + content: some providers reject extra fields (the notebook's Groq tip)
  const clean = (history ?? []).map(({ role, content }) => ({ role, content }));
  const reply = await chat(system, message, clean);
  return c.json({ reply });
});

app.use("/*", serveStatic({ root: "./web/dist" }));

const port = Number(process.env.PORT ?? 8788);
serve({ fetch: app.fetch, port });
console.log(`Career chat API on http://localhost:${port}`);
