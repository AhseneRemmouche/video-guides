// The API behind the React code-optimiser page (Week 4, served over HTTP).
//   POST /api/optimize  {python, model}  -> streamed C++ port of the Python
// Reads OPENAI_API_KEY / ANTHROPIC_API_KEY from the environment; with the needed key
// missing it returns a clear 400 JSON error instead of crashing.
import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { streamText } from "hono/streaming";
import { optimizePython, MissingKeyError, type Model } from "../src/optimize.js";

const app = new Hono();

function parseModel(value: unknown): Model | null {
  return value === "gpt-4o" || value === "claude" ? value : null;
}

app.post("/api/optimize", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    python?: unknown;
    model?: unknown;
  };

  const python = typeof body.python === "string" ? body.python : "";
  const model = parseModel(body.model);
  if (!python.trim()) return c.json({ error: "Body must include non-empty 'python'" }, 400);
  if (!model) return c.json({ error: "Body must include model 'gpt-4o' or 'claude'" }, 400);

  // Fail fast with a 400 when the key for the chosen model is missing, before streaming starts.
  const needsOpenAI = model === "gpt-4o";
  if (needsOpenAI && !process.env.OPENAI_API_KEY)
    return c.json({ error: "OPENAI_API_KEY is not set on the server" }, 400);
  if (!needsOpenAI && !process.env.ANTHROPIC_API_KEY)
    return c.json({ error: "ANTHROPIC_API_KEY is not set on the server" }, 400);

  return streamText(c, async (stream) => {
    try {
      for await (const chunk of optimizePython(python, model)) {
        await stream.write(chunk);
      }
    } catch (err) {
      // The stream has already started (200), so surface the error inline as a comment.
      const message = err instanceof MissingKeyError ? err.message : String(err);
      await stream.write(`\n// error: ${message}\n`);
    }
  });
});

// Serve the built React app (run `npm run build` first).
app.use("/*", serveStatic({ root: "./web/dist" }));

const port = Number(process.env.PORT ?? 8788);
serve({ fetch: app.fetch, port });
console.log(`LLM Engineering Week 4 API on http://localhost:${port}`);
