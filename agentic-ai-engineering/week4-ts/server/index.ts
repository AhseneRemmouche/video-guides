// Week 4 - the Sidekick API behind the React app (replaces app.py's Gradio UI).
// POST /api/sidekick { message, successCriteria } builds a fresh Sidekick, runs one
// superstep through the worker/evaluator graph, and returns the result as JSON.
//
// Each request gets its own Sidekick instance (its own tools + memory thread), mirroring
// the course's "a fresh graph per session". Live LLM calls go to the Ollama base URL set
// in src/model.ts, so this COULD run end to end once Ollama is up.
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Sidekick } from "../src/sidekick.js";

const app = new Hono();

app.post("/api/sidekick", async (c) => {
  let message = "";
  let successCriteria = "";
  try {
    ({ message, successCriteria } = await c.req.json<{ message: string; successCriteria: string }>());
  } catch {
    return c.json({ error: "Body must be JSON: { message, successCriteria }" }, 400);
  }
  if (!message?.trim()) return c.json({ error: "message is required" }, 400);

  try {
    const sidekick = new Sidekick();
    await sidekick.setup();
    const result = await sidekick.run(message, successCriteria ?? "");
    return c.json(result);
  } catch (e) {
    // Most likely the Ollama server is not running, or the model is not pulled.
    return c.json({ error: String(e) }, 500);
  }
});

// Serve the production build of the React app (npm run build).
app.use("/*", serveStatic({ root: "./web/dist" }));

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.log(`Sidekick API on http://localhost:${port}`);
