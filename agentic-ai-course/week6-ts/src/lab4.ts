// Week 6 Day 4 — port of 6_mcp/4_lab4.ipynb (its final part): run one autonomous trader, Ed, with traders.ts.
// The notebook first builds the researcher and trader by hand, then moves that code into mcp_params.py, templates.py
// and traders.py; this lab uses the finished modules (the same steps as cells 16 and 25-28).
// Run: pnpm lab4      (count_tools.ts ports cell 30, which counts the servers and tools)
import "./setup.js";
import { Account } from "./accounts.js";
import { readAccountsResource, readStrategyResource } from "./accounts_client.js";
import { Trader } from "./traders.js";

const edInitialStrategy = "You are a day trader that aggressively buys and sells shares based on news and market conditions.";
Account.get("Ed").reset(edInitialStrategy);
console.log(await readAccountsResource("Ed"));
console.log(await readStrategyResource("Ed"));

const trader = new Trader("Ed");
const result = await trader.run();
console.log("\nTrader's final reply:\n" + (result?.finalOutput ?? "(no result: see the error above)"));

console.log("\nAccount afterwards:\n" + (await readAccountsResource("Ed")));
