// The API behind the React "knowledge worker" page.
//   POST /api/ask  {question, history?}  -> {answer, sources}  using the Day 4/5 RAG pipeline
// Reads OPENAI_API_KEY from the environment; with no key it returns a clear 400 JSON error
// (the RAG pipeline needs a key both to embed the docs and to call the chat model).
import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { answer, type ChatMessage } from "../src/rag.js";
import { hasOpenAIKey } from "../src/ingest.js";

type AskBody = { question?: unknown; history?: unknown };

// Minimal, dependency-free body validation.
function parseAsk(body: AskBody): { question: string; history: ChatMessage[] } | null {
  if (typeof body?.question !== "string" || body.question.trim().length === 0) return null;
  let history: ChatMessage[] = [];
  if (Array.isArray(body.history)) {
    history = body.history
      .filter(
        (m): m is ChatMessage =>
          !!m &&
          typeof m === "object" &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string",
      )
      .map((m) => ({ role: m.role, content: m.content }));
  }
  return { question: body.question, history };
}

const app = new Hono();

app.post("/api/ask", async (c) => {
  if (!hasOpenAIKey()) {
    return c.json({ error: "OPENAI_API_KEY is not set on the server" }, 400);
  }
  const parsed = parseAsk(await c.req.json().catch(() => ({})));
  if (!parsed) {
    return c.json({ error: "Body must be { question: string, history?: {role, content}[] }" }, 400);
  }
  try {
    const result = await answer(parsed.question, parsed.history);
    return c.json(result);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

// Serve the built React app (run `npm run build` first).
app.use("/*", serveStatic({ root: "./web/dist" }));

const port = Number(process.env.PORT ?? 8788);
serve({ fetch: app.fetch, port });
console.log(`LLM Engineering Week 5 (RAG) API on http://localhost:${port}`);
