// Port of 6_mcp/trading_floor.py — the engine: create the four traders and run them all at once every N minutes.
// Settings (.env): RUN_EVERY_N_MINUTES (default 60), RUN_EVEN_WHEN_MARKET_IS_CLOSED (default false),
// USE_MANY_MODELS (default false). Not in the course: RUN_ONCE=true does one round and exits.
// Differences: Promise.all replaces asyncio.gather; in local mode (setup.ts) the four traders use MODEL (e.g. llama3.2).
// Run: pnpm trading-floor
import { pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { addTraceProcessor } from "@openai/agents";
import { model } from "./setup.js";
import { Trader } from "./traders.js";
import { LogTracer } from "./tracers.js";
import { isMarketOpen } from "./market.js";

const RUN_EVERY_N_MINUTES = Number(process.env.RUN_EVERY_N_MINUTES ?? "60");
const RUN_EVEN_WHEN_MARKET_IS_CLOSED = (process.env.RUN_EVEN_WHEN_MARKET_IS_CLOSED ?? "false").trim().toLowerCase() === "true";
const USE_MANY_MODELS = (process.env.USE_MANY_MODELS ?? "false").trim().toLowerCase() === "true";
const RUN_ONCE = (process.env.RUN_ONCE ?? "false").trim().toLowerCase() === "true";

export const names = ["Warren", "George", "Ray", "Cathie"];
export const lastnames = ["Patience", "Bold", "Systematic", "Crypto"];

export let modelNames: string[];
export let shortModelNames: string[];
if (USE_MANY_MODELS) {
  modelNames = ["gpt-4.1-mini", "deepseek-chat", "gemini-2.5-flash-preview-04-17", "grok-3-mini-beta"];
  shortModelNames = ["GPT 4.1 Mini", "DeepSeek V3", "Gemini 2.5 Flash", "Grok 3 Mini"];
} else {
  modelNames = Array(4).fill(model("gpt-4o-mini"));
  shortModelNames = Array(4).fill(process.env.MODEL ?? "GPT 4o mini");
}

export function createTraders(): Trader[] {
  return names.map((name, i) => new Trader(name, lastnames[i], modelNames[i]));
}

async function runEveryNMinutes() {
  addTraceProcessor(new LogTracer());
  const traders = createTraders();
  while (true) {
    if (RUN_EVEN_WHEN_MARKET_IS_CLOSED || (await isMarketOpen())) {
      await Promise.all(traders.map((trader) => trader.run()));
    } else {
      console.log("Market is closed, skipping run");
    }
    if (RUN_ONCE) break;
    await sleep(RUN_EVERY_N_MINUTES * 60 * 1000);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`Starting scheduler to run every ${RUN_EVERY_N_MINUTES} minutes`);
  await runEveryNMinutes();
}
