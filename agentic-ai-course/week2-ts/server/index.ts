// Week 2 Day 5 — the deep-research API behind the React app (replaces the Gradio app deep_research.py)
// POST /api/research {query} streams Server-Sent Events: {type:"status"} lines, then one {type:"report"} with markdown.
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { ResearchManager } from "../src/deep_research/manager.js";

const app = new Hono();

app.post("/api/research", async (c) => {
  const { query } = await c.req.json<{ query: string }>();
  if (!query?.trim()) return c.json({ error: "query is required" }, 400);
  return streamSSE(c, async (stream) => {
    try {
      let last = "";
      for await (const chunk of new ResearchManager().run(query)) last = chunk, await stream.writeSSE({ data: JSON.stringify({ type: "status", text: chunk }) });
      // the generator's final value is the markdown report; send it again under its own event type
      await stream.writeSSE({ data: JSON.stringify({ type: "report", markdown: last }) });
    } catch (e) {
      await stream.writeSSE({ data: JSON.stringify({ type: "error", message: String(e) }) });
    }
  });
});

app.use("/*", serveStatic({ root: "./web/dist" })); // production build of the React app (pnpm build)

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.log(`Deep Research API on http://localhost:${port}`);
