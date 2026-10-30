// The API behind the Week 8 "deal hunting" dashboard (served over HTTP).
//   GET /api/deals  -> the sample deals, ranked by discount (biggest first)
//
// In a real build this endpoint would return the deals surfaced by the Python
// agent pipeline (Planning -> Scanner -> Ensemble pricer -> Messaging). Here it
// just serves clearly-labelled SAMPLE data, so no API key or network is needed.
import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { rankByDiscount, sampleDeals, discountPercent } from "../src/deals.js";

const app = new Hono();

app.get("/api/deals", (c) => {
  // Real build: deals would come from the agent pipeline. Demo: ranked sample data.
  const deals = rankByDiscount(sampleDeals()).map((deal) => ({
    ...deal,
    discountPercent: discountPercent(deal),
  }));
  return c.json({ sample: true, count: deals.length, deals });
});

// Serve the built React app (run `npm run build` first).
app.use("/*", serveStatic({ root: "./web/dist" }));

const port = Number(process.env.PORT ?? 8788);
serve({ fetch: app.fetch, port });
console.log(`LLM Engineering Week 8 API on http://localhost:${port}`);
