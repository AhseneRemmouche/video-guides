// The API behind the React product-pricer page (Week 6, served over HTTP).
//   POST /api/price  {description}  -> {price}
// Reads OPENAI_API_KEY from the environment; with the key missing it returns a
// clear 400 JSON error instead of crashing.
import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { estimatePrice, priceModel } from "../src/price.js";

const app = new Hono();

app.post("/api/price", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { description?: unknown };
  const description = typeof body.description === "string" ? body.description : "";
  if (!description.trim())
    return c.json({ error: "Body must include non-empty 'description'" }, 400);

  // Fail fast with a 400 when the key is missing, before we try to call OpenAI.
  if (!process.env.OPENAI_API_KEY)
    return c.json({ error: "OPENAI_API_KEY is not set on the server" }, 400);

  try {
    const price = await estimatePrice(description);
    if (!Number.isFinite(price))
      return c.json({ error: "Could not parse a price from the model reply" }, 502);
    return c.json({ price, model: priceModel() });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// Serve the built React app (run `npm run build` first).
app.use("/*", serveStatic({ root: "./web/dist" }));

const port = Number(process.env.PORT ?? 8788);
serve({ fetch: app.fetch, port });
console.log(`LLM Engineering Week 6 API on http://localhost:${port}`);
