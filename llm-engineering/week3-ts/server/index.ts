// The API behind the React page: runs a transformers.js pipeline server-side.
//   POST /api/analyze  {text, task?}  -> { task, result }
//     task "sentiment" (default) -> sentiment-analysis
//     task "summary"             -> summarization
// The model is lazy-loaded and cached on first request (the download happens then),
// so the server starts instantly and the first /api/analyze call is the slow one.
import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { pipeline } from "@huggingface/transformers";

const SENTIMENT_MODEL = "Xenova/distilbert-base-uncased-finetuned-sst-2-english";
const SUMMARIZATION_MODEL = "Xenova/distilbart-cnn-6-6";

// Cache each pipeline so a model loads at most once, on first use.
type AnyPipeline = (...args: any[]) => Promise<any>;
const cache = new Map<string, Promise<AnyPipeline>>();

function getPipeline(task: "sentiment" | "summary"): Promise<AnyPipeline> {
  const existing = cache.get(task);
  if (existing) return existing;
  // Cast each branch to the same simple type so TS does not build a huge union of the
  // two pipeline return types (which trips "union type that is too complex", TS2590).
  const loading: Promise<AnyPipeline> =
    task === "summary"
      ? (pipeline("summarization", SUMMARIZATION_MODEL) as unknown as Promise<AnyPipeline>)
      : (pipeline("sentiment-analysis", SENTIMENT_MODEL) as unknown as Promise<AnyPipeline>);
  cache.set(task, loading);
  return loading;
}

const app = new Hono();

app.post("/api/analyze", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    text?: unknown;
    task?: unknown;
  };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const task = body.task === "summary" ? "summary" : "sentiment";
  if (!text) return c.json({ error: "Body must be { text: string, task?: 'sentiment' | 'summary' }" }, 400);

  try {
    const pipe = await getPipeline(task);
    const result =
      task === "summary"
        ? (await pipe(text, { max_new_tokens: 60 }))[0]?.summary_text ?? ""
        : (await pipe(text))[0];
    return c.json({ task, result });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// Serve the built React app (run `npm run build` first).
app.use("/*", serveStatic({ root: "./web/dist" }));

const port = Number(process.env.PORT ?? 8789);
serve({ fetch: app.fetch, port });
console.log(`LLM Engineering Week 3 API on http://localhost:${port}`);
