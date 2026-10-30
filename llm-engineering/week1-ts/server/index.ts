// The API behind the React page (Day 1 + Day 5, served over HTTP).
//   POST /api/summarize {url}            -> {summary}         (Day 1 website summarizer)
//   POST /api/brochure  {company, url}   -> streamed markdown (Day 5 company brochure)
// Reads OPENAI_API_KEY from the environment; with no key it returns a clear 400 JSON error.
import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { streamText } from "hono/streaming";
import { z } from "zod";
import OpenAI from "openai";
import { fetchWebsite, getContents, type Website } from "../src/scrape.js";

const MODEL = "gpt-4o-mini";

// Build the client lazily: constructing OpenAI with no key throws, and we want a 400 instead.
function getClient(): OpenAI | null {
  return process.env.OPENAI_API_KEY ? new OpenAI() : null;
}

const summarizeBody = z.object({ url: z.string().url() });
const brochureBody = z.object({ company: z.string().min(1), url: z.string().url() });

// --- Day 1 prompts ------------------------------------------------------------
const summarizeSystem =
  "You are an assistant that analyzes the contents of a website and provides a short " +
  "summary, ignoring text that might be navigation related. Respond in markdown.";

function summarizeUserPrompt(site: Website): string {
  return (
    `You are looking at a website titled ${site.title}\n` +
    "The contents of this website is as follows; please provide a short summary of this " +
    "website in markdown. If it includes news or announcements, then summarize these too.\n\n" +
    site.text
  );
}

// --- Day 5 prompts ------------------------------------------------------------
const brochureSystem =
  "You are an assistant that analyzes the contents of a company website and creates a short " +
  "brochure about the company for prospective customers, investors and recruits. Respond in " +
  "markdown. Include details of company culture, customers and careers/jobs if you have the information.";

const app = new Hono();

app.post("/api/summarize", async (c) => {
  const openai = getClient();
  if (!openai) return c.json({ error: "OPENAI_API_KEY is not set on the server" }, 400);

  const parsed = summarizeBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Body must be { url: string }" }, 400);

  const site = await fetchWebsite(parsed.data.url);
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: summarizeSystem },
      { role: "user", content: summarizeUserPrompt(site) },
    ],
  });
  return c.json({ summary: response.choices[0]?.message.content ?? "" });
});

app.post("/api/brochure", async (c) => {
  const openai = getClient();
  if (!openai) return c.json({ error: "OPENAI_API_KEY is not set on the server" }, 400);

  const parsed = brochureBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Body must be { company: string, url: string }" }, 400);

  const { company, url } = parsed.data;
  const site = await fetchWebsite(url);
  const userPrompt =
    `You are looking at a company called: ${company}\n` +
    "Here are the contents of its landing page; use this to build a short brochure in markdown.\n" +
    getContents(site);

  // Stream the markdown back to the browser as it is generated.
  return streamText(c, async (stream) => {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: brochureSystem },
        { role: "user", content: userPrompt.slice(0, 5_000) },
      ],
      stream: true,
    });
    for await (const chunk of completion) {
      await stream.write(chunk.choices[0]?.delta.content ?? "");
    }
  });
});

// Serve the built React app (run `npm run build` first).
app.use("/*", serveStatic({ root: "./web/dist" }));

const port = Number(process.env.PORT ?? 8788);
serve({ fetch: app.fetch, port });
console.log(`LLM Engineering Week 1 API on http://localhost:${port}`);
