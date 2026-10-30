// Week 2 Day 5 - the deep-research API behind the React app (replaces the Gradio app deep_research.py).
// POST /api/research { query } runs the ResearchManager and returns a short report as JSON.
// It returns 400 when OPENAI_API_KEY is missing (and no local base URL is set), so the UI can show a clear
// message instead of the SDK failing deep inside a run.
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { ResearchManager } from "../src/research/manager.js";
import { hasModelAccess } from "../src/setup.js";

const app = new Hono();

app.post("/api/research", async (c) => {
  if (!hasModelAccess) {
    return c.json(
      { error: "No OPENAI_API_KEY set. Add one to .env (or set OPENAI_BASE_URL for a local model)." },
      400,
    );
  }

  let query = "";
  try {
    ({ query } = await c.req.json<{ query: string }>());
  } catch {
    return c.json({ error: "Body must be JSON: { query }" }, 400);
  }
  if (!query?.trim()) return c.json({ error: "query is required" }, 400);

  try {
    const manager = new ResearchManager();
    const status: string[] = [];
    // Drain the generator to completion; the manager stores the full report on itself.
    for await (const chunk of manager.run(query)) {
      if (chunk.length < 300) status.push(chunk);
    }
    const report = manager.report;
    if (!report) return c.json({ error: "No report was produced" }, 500);
    return c.json({
      summary: report.short_summary,
      report: report.markdown_report,
      follow_up_questions: report.follow_up_questions,
      status,
    });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// Serve the production build of the React app (npm run build).
app.use("/*", serveStatic({ root: "./web/dist" }));

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.log(`Deep Research API on http://localhost:${port}`);
