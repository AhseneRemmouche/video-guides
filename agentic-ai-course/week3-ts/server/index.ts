// A small API that runs a crew and streams its progress to the React page (Server-Sent Events).
// GET /api/crews lists the crews and their inputs; POST /api/run {crew, inputs} streams task_start / task_end events.
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { loadCrew, runSequential, type CrewEvent, type CrewOptions } from "../src/minicrew.js";
import { codeTool, searchTool } from "../src/tools.js";

// The crews that run sequentially, with the inputs their YAML expects and the tools each agent gets.
const CREWS: Record<string, { inputs: Record<string, string>; tools?: CrewOptions["tools"] }> = {
  debate: { inputs: { motion: "There needs to be strict laws to regulate LLMs" } },
  financial_researcher: { inputs: { company: "Apple" }, tools: { researcher: [searchTool] } },
  coder: { inputs: { assignment: "Write a python program that prints the first 10 prime numbers" }, tools: { coder: [codeTool] } },
};

const app = new Hono();

app.get("/api/crews", (c) => c.json(Object.fromEntries(Object.entries(CREWS).map(([k, v]) => [k, v.inputs]))));

app.post("/api/run", async (c) => {
  const { crew: name, inputs } = await c.req.json<{ crew: string; inputs: Record<string, string> }>();
  const def = CREWS[name];
  if (!def) return c.json({ error: `unknown crew ${name}` }, 400);
  return streamSSE(c, async (stream) => {
    const send = (e: CrewEvent | { type: "done" } | { type: "error"; message: string }) => stream.writeSSE({ data: JSON.stringify(e) });
    try {
      const crew = await loadCrew(`crews/${name}`, { ...def.inputs, ...inputs });
      await runSequential(crew, { tools: def.tools, outputDir: `output/web/${name}`, onEvent: (e) => void send(e) });
      await send({ type: "done" });
    } catch (e) {
      await send({ type: "error", message: String(e) });
    }
  });
});

app.use("/*", serveStatic({ root: "./web/dist" }));

const port = Number(process.env.PORT ?? 8789);
serve({ fetch: app.fetch, port });
console.log(`Crew runner API on http://localhost:${port}`);
