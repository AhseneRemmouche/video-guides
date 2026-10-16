// Week 6 Day 3 — port of 6_mcp/3_lab3.ipynb: more MCP servers, one of each kind.
// 1. Runs locally, everything local: knowledge-graph memory (npx mcp-memory-libsql, stored in memory/ed.db).
// 2. Runs locally, calls a web service: Brave Search (needs BRAVE_API_KEY; skipped with a message otherwise).
// 3. Our market server (market_server.ts): Polygon prices with POLYGON_API_KEY, otherwise labelled stand-in prices.
// 4. Only with POLYGON_PLAN=paid or realtime: Polygon's own MCP server (uvx ... mcp_polygon).
// Run: pnpm lab3            (or pnpm lab3 memory | brave | market | polygon for one section)
import { Agent, MCPServerStdio, run, withTrace } from "@openai/agents";
import { model, networkEnv } from "./setup.js";
import { getSharePrice } from "./market.js";

type Params = { command: string; args: string[]; env?: Record<string, string> };
const only = process.argv[2];

/** Open a server, list its tools, then run an agent with it for each request (the "async with" cells). */
async function tryServer(params: Params, instructions: string, requests: string[], courseModel: string) {
  const server = new MCPServerStdio({ ...params, env: { ...networkEnv, ...params.env }, clientSessionTimeoutSeconds: 60 }); // networkEnv: see setup.ts
  await server.connect();
  try {
    console.log("tools:", (await server.listTools()).map((t) => t.name).join(", "));
    const agent = new Agent({ name: "agent", instructions, model: model(courseModel), mcpServers: [server] });
    for (const request of requests) {
      const result = await withTrace("conversation", () => run(agent, request));
      console.log(`\n> ${request}\n${result.finalOutput}\n`);
    }
  } finally {
    await server.close();
  }
}

if (!only || only === "memory") {
  console.log("\n=== 1. Memory (knowledge graph) ===");
  await tryServer(
    { command: "npx", args: ["-y", "mcp-memory-libsql"], env: { LIBSQL_URL: "file:./memory/ed.db" } },
    "You use your entity tools as a persistent memory to store and recall information about your conversations.",
    [
      "My name's Ed. I'm an LLM engineer. I'm teaching a course about AI Agents, including the incredible MCP protocol. " +
        "MCP is a protocol for connecting agents with tools, resources and prompt templates, and makes it easy to integrate AI agents with capabilities.",
      "My name's Ed. What do you know about me?",
    ],
    "gpt-4.1-mini",
  );
}

if (!only || only === "brave") {
  console.log("\n=== 2. Brave Search ===");
  const braveApiKey = process.env.BRAVE_API_KEY;
  if (!braveApiKey) {
    console.log("Skipped: BRAVE_API_KEY is not set (free key at https://brave.com/search/api/). The server exits without it.");
  } else {
    await tryServer(
      { command: "npx", args: ["-y", "@modelcontextprotocol/server-brave-search"], env: { BRAVE_API_KEY: braveApiKey } },
      "You are able to search the web for information and briefly summarize the takeaways.",
      [`Please research the latest news on Amazon stock price and briefly summarize its outlook. For context, the current date is ${new Date().toISOString().slice(0, 10)}`],
      "gpt-4o-mini",
    );
  }
}

if (!only || only === "market") {
  console.log("\n=== 3. Market data ===");
  console.log(process.env.POLYGON_API_KEY ? "POLYGON_API_KEY is set" : "POLYGON_API_KEY is not set: prices are STAND-IN values, not real market data");
  console.log("AAPL:", await getSharePrice("AAPL"));
  for (let i = 0; i < 1000; i++) await getSharePrice("AAPL"); // no rate limiting concerns: cached after the first call
  console.log("AAPL after 1000 lookups:", await getSharePrice("AAPL"));
  await tryServer(
    { command: process.execPath, args: ["--import", "tsx", "src/market_server.ts"] },
    "You answer questions about the stock market.",
    ["What's the share price of Apple?"],
    "gpt-4.1-mini",
  );
}

if (!only || only === "polygon") {
  const plan = process.env.POLYGON_PLAN;
  if (plan === "paid" || plan === "realtime") {
    console.log("\n=== 4. Polygon.io's own MCP server (paid plan) ===");
    await tryServer(
      { command: "uvx", args: ["--from", "git+https://github.com/polygon-io/mcp_polygon@v0.1.0", "mcp_polygon"], env: { POLYGON_API_KEY: process.env.POLYGON_API_KEY ?? "" } },
      "You answer questions about the stock market.",
      ["What's the share price of Apple? Use your get_snapshot_ticker tool to get the latest price."],
      "gpt-4.1-mini",
    );
  } else {
    console.log("\nAccording to your .env file you are on the free Polygon plan (or have no key), so the code looks at EOD prices; section 4 skipped.");
  }
}
