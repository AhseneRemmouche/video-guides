// Not in the course: fills accounts.db with clearly labelled DEMO DATA so the dashboard has something to show without
// any model or API key. It resets the four traders, buys a few shares for each through the real accounts.ts code
// (at stand-in prices when there is no POLYGON_API_KEY), and back-fills a week of portfolio values computed from
// market.ts's stand-in prices. Nothing here was decided by an agent. Run: pnpm seed-demo  (pnpm reset clears it)
import { Account, timestampNow } from "./accounts.js";
import { writeLog } from "./database.js";
import { standInPrice } from "./market.js";
import { resetTraders } from "./reset.js";

const demoBuys: Record<string, [string, number][]> = {
  Warren: [["BRK.B", 6], ["KO", 30], ["JNJ", 12]],
  George: [["TLT", 25], ["GLD", 10], ["XOM", 15]],
  Ray: [["VTI", 10], ["TLT", 15], ["GLD", 6], ["SPY", 3]],
  Cathie: [["IBIT", 60], ["ETHA", 120], ["ARKK", 30]],
};

resetTraders();
for (const [name, buys] of Object.entries(demoBuys)) {
  writeLog(name, "trace", "DEMO DATA seeded by seed_demo.ts (not a real trading run)");
  const account = Account.get(name);
  for (const [symbol, quantity] of buys) await account.buyShares(symbol, quantity, "[DEMO] seeded by seed_demo.ts, not an agent decision");

  // Back-fill the value chart: one point per day for the past 7 days, as if these holdings had been held all week.
  const backfill: [string, number][] = [];
  for (let daysAgo = 7; daysAgo >= 1; daysAgo--) {
    const day = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);
    let value = account.balance;
    for (const [symbol, quantity] of Object.entries(account.holdings)) value += standInPrice(symbol, day) * quantity;
    backfill.push([timestampNow(day), value]);
  }
  account.portfolio_value_time_series = [...backfill, ...account.portfolio_value_time_series];
  account.save();
  console.log(`${name}: ${buys.map(([s, q]) => `${q} ${s}`).join(", ")}; cash left $${account.balance.toFixed(2)}`);
}
console.log("Seeded DEMO DATA for Warren, George, Ray and Cathie.");
