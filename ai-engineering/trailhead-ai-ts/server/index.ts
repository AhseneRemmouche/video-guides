// A small HTTP server for the web app. Run: pnpm api  (then pnpm web in a second terminal)
//   POST /api/chat      { message }                    -> a stream of events (below)
//   POST /api/feedback  { traceId, rating, comment? }  -> { ok: true }
//   GET  /api/stats                                    -> the dashboard numbers of lab 12
// Chat events are Server-Sent Events: "input" (the input guardrail's result), "sources" (retrieved chunks),
// "token" (answer text), "output" (the output guardrail's result), "done" (trace id and cost), "error".
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import * as config from "../src/config.js";
import { loadChunks } from "../src/docs.js";
import { checkInput, checkOutput } from "../src/guardrails.js";
import { client } from "../src/llm.js";
import { formatContext, loadPrompt } from "../src/rag.js";
import { Hybrid } from "../src/retrieve.js";
import { connect, logFeedback, logTrace } from "../src/tracing.js";

const retriever = new Hybrid(loadChunks()); // embeds the 23 chunks once, when the server starts
const db = connect(); // the same runs/traces.db as lab 12
const FALLBACK = "Sorry, I can't help with that here. Please contact support@trailhead.example.";

const app = new Hono();

app.post("/api/chat", async (c) => {
  const { message } = await c.req.json<{ message: string }>();
  return streamSSE(c, async (sse) => {
    const send = (event: string, data: unknown) => sse.writeSSE({ event, data: JSON.stringify(data) });
    try {
      // 1. Input guardrail: block injections, and redact personal data before the model (or the log) sees it.
      const input = checkInput(message);
      await send("input", input);
      if (!input.allowed) {
        await send("done", { traceId: null });
        return;
      }

      // 2. Retrieve, then stream the answer with the rag_v2 prompt, token by token.
      const start = performance.now();
      const results = await retriever.search(input.cleaned, 3);
      await send("sources", results.map(([chunk, score]) => ({ id: chunk.id, title: chunk.title, score })));
      const system = loadPrompt("rag_v2").replace("{context}", formatContext(results));
      const stream = await client.chat.completions.create({
        model: config.MODEL,
        messages: [{ role: "system", content: system }, { role: "user", content: input.cleaned }],
        temperature: 0,
        reasoning_effort: config.REASONING_EFFORT,
        stream: true,
        stream_options: { include_usage: true }, // the last event carries the token counts
      });
      let text = "";
      let usage = { prompt_tokens: 0, completion_tokens: 0 };
      let model: string = config.MODEL;
      for await (const event of stream) {
        model = event.model || model;
        if (event.usage) usage = event.usage;
        const piece = event.choices[0]?.delta.content;
        if (piece) {
          text += piece;
          await send("token", piece);
        }
      }

      // 3. Output guardrail. The words are already on screen, so a blocked answer is replaced, not hidden.
      const chunks = results.map(([chunk]) => chunk.id);
      const output = checkOutput(text, chunks);
      await send("output", { ...output, fallback: output.allowed ? null : FALLBACK });

      // 4. Trace it (with the redacted question), so the thumbs can be attached to this exact answer.
      const reply = {
        text, model, inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens,
        seconds: (performance.now() - start) / 1000,
      };
      const traceId = logTrace(db, input.cleaned, { answer: text, chunks, reply }, "rag_v2");
      await send("done", { traceId, seconds: reply.seconds, inputTokens: reply.inputTokens, outputTokens: reply.outputTokens });
    } catch (error) {
      await send("error", error instanceof Error ? error.message : String(error));
    }
  });
});

app.post("/api/feedback", async (c) => {
  const { traceId, rating, comment } = await c.req.json<{ traceId: string; rating: number; comment?: string }>();
  if (rating !== 1 && rating !== -1) return c.json({ error: "rating must be 1 or -1" }, 400);
  logFeedback(db, traceId, rating, comment ?? "");
  return c.json({ ok: true });
});

app.get("/api/stats", (c) => {
  const row = db.prepare(`SELECT COUNT(*) AS answers, AVG(seconds) AS seconds,
    (SELECT COUNT(*) FROM feedback WHERE rating > 0) AS up, (SELECT COUNT(*) FROM feedback WHERE rating < 0) AS down
    FROM traces`).get();
  return c.json(row);
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.log(`Trailhead support API on http://localhost:${port}`);
