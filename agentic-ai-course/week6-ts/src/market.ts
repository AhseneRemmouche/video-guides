// Port of 6_mcp/market.py — share prices from Polygon.io, with the free plan's end-of-day prices cached in the database.
// Differences: plain fetch calls to Polygon's REST API replace the polygon-api-client package, so the functions are async.
// Without POLYGON_API_KEY the course returns random.randint(1, 100) on every call; here a clearly labelled STAND-IN
// gives repeatable fake prices (a fixed table plus a small daily wobble), so portfolios do not jump around on every refresh.
import { config } from "dotenv";
import { readMarket, writeMarket } from "./database.js";

config({ override: true, quiet: true });

const polygonApiKey = process.env.POLYGON_API_KEY;
const polygonPlan = process.env.POLYGON_PLAN;

export const isPaidPolygon = polygonPlan === "paid";
export const isRealtimePolygon = polygonPlan === "realtime";

const POLYGON = "https://api.polygon.io";

async function polygon(path: string): Promise<any> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${POLYGON}${path}${sep}apiKey=${polygonApiKey}`);
  if (!res.ok) throw new Error(`Polygon ${res.status} ${res.statusText}`);
  return res.json();
}

export async function isMarketOpen(): Promise<boolean> {
  if (!polygonApiKey) return standInIsMarketOpen();
  const status = await polygon("/v1/marketstatus/now");
  return status.market === "open";
}

/** Every share's closing price on the last trading day, in one call (the free plan allows only a few calls a minute). */
async function getAllSharePricesPolygonEod(): Promise<Record<string, number>> {
  const probe = await polygon("/v2/aggs/ticker/SPY/prev"); // the previous close of SPY tells us the last trading day
  const lastClose = new Date(probe.results[0].t).toISOString().slice(0, 10);
  const grouped = await polygon(`/v2/aggs/grouped/locale/us/market/stocks/${lastClose}?adjusted=true&include_otc=false`);
  return Object.fromEntries((grouped.results ?? []).map((r: { T: string; c: number }) => [r.T, r.c]));
}

const memo = new Map<string, Record<string, number>>(); // stands in for @lru_cache

async function getMarketForPriorDate(today: string): Promise<Record<string, number>> {
  if (memo.has(today)) return memo.get(today)!;
  let marketData = readMarket(today);
  if (!marketData) {
    marketData = await getAllSharePricesPolygonEod();
    writeMarket(today, marketData);
  }
  memo.set(today, marketData);
  return marketData;
}

async function getSharePricePolygonEod(symbol: string): Promise<number> {
  const today = localDate(new Date());
  const marketData = await getMarketForPriorDate(today);
  return marketData[symbol] ?? 0.0;
}

async function getSharePricePolygonMin(symbol: string): Promise<number> {
  const result = await polygon(`/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}`);
  return result.ticker?.min?.c || result.ticker?.prevDay?.c;
}

async function getSharePricePolygon(symbol: string): Promise<number> {
  return isPaidPolygon ? getSharePricePolygonMin(symbol) : getSharePricePolygonEod(symbol);
}

export async function getSharePrice(symbol: string): Promise<number> {
  if (polygonApiKey) {
    try {
      return await getSharePricePolygon(symbol);
    } catch (e) {
      console.error(`Was not able to use the polygon API due to ${e}; using a stand-in price`);
    }
  }
  return standInPrice(symbol, new Date());
}

// ---------------------------------------------------------------------------------------------------------------
// STAND-IN (not in the course): fake prices, used only when there is no POLYGON_API_KEY. NOT real market data.

const STAND_IN_BASE: Record<string, number> = {
  AAPL: 230, MSFT: 420, AMZN: 185, NVDA: 120, GOOGL: 165, META: 560, TSLA: 250, "BRK.B": 450, JPM: 210, KO: 63,
  JNJ: 155, XOM: 115, SPY: 560, QQQ: 480, VTI: 275, TLT: 92, GLD: 240, IBIT: 55, ETHA: 20, BITO: 21, ARKK: 50,
};

/** A number between 0 and 1 computed from a string, the same every time. */
function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

export function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Fake price: a fixed base (unknown symbols get 1-100, like the course's random price) wobbling up to ±3% per day. */
export function standInPrice(symbol: string, day: Date): number {
  const s = symbol.toUpperCase();
  const base = STAND_IN_BASE[s] ?? 1 + Math.floor(hash(s) * 100);
  const wobble = (hash(`${s}|${localDate(day)}`) - 0.5) * 0.06;
  return Math.round(base * (1 + wobble) * 100) / 100;
}

/** Rough NYSE hours (Mon-Fri 9:30-16:00 New York time, holidays ignored), used when there is no Polygon key. */
function standInIsMarketOpen(): boolean {
  const ny = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const minutes = ny.getHours() * 60 + ny.getMinutes();
  return ny.getDay() >= 1 && ny.getDay() <= 5 && minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}
