// Week 6 Day 5 — the API behind the React dashboard (replaces the data side of the Gradio app 6_mcp/app.py).
// It only reads accounts.db; the trading floor (pnpm trading-floor) is what writes to it.
//   GET /api/traders              names, last names and model names (from trading_floor.ts)
//   GET /api/traders/:name        portfolio value, profit/loss, value time series, holdings, transactions
//   GET /api/traders/:name/logs   the last 13 log lines (what LogTracer and accounts.ts wrote)
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Account } from "../src/accounts.js";
import { readLog } from "../src/database.js";
import { lastnames, names, shortModelNames } from "../src/trading_floor.js";

const app = new Hono();

app.get("/api/traders", (c) => c.json(names.map((name, i) => ({ name, lastname: lastnames[i], modelName: shortModelNames[i] }))));

app.get("/api/traders/:name", async (c) => {
  const account = Account.get(c.req.param("name"));
  const portfolioValue = (await account.calculatePortfolioValue()) || 0.0;
  const pnl = account.calculateProfitLoss(portfolioValue) || 0.0;
  return c.json({
    portfolioValue,
    pnl,
    timeSeries: account.portfolio_value_time_series.map(([datetime, value]) => ({ datetime, value })),
    holdings: Object.entries(account.getHoldings()).map(([symbol, quantity]) => ({ symbol, quantity })),
    transactions: account.listTransactions(),
  });
});

app.get("/api/traders/:name/logs", (c) => c.json(readLog(c.req.param("name"), 13)));

app.use("/*", serveStatic({ root: "./web/dist" })); // production build of the React app (pnpm build)

const port = Number(process.env.PORT ?? 8791);
serve({ fetch: app.fetch, port });
console.log(`Trading floor API on http://localhost:${port}`);
