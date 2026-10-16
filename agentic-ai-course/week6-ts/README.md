# Week 6 in TypeScript (MCP and the autonomous trading floor)

A port of the Week 6 labs of *The Complete Agentic AI Engineering Course* (Ed Donner) to TypeScript, built for the
companion guide. Not part of the course. Uses `@openai/agents` 0.20.0, the official MCP TypeScript SDK v2
(`@modelcontextprotocol/server` and `@modelcontextprotocol/client` 2.3.1), Node's built-in `node:sqlite`, zod, Hono
and React + Vite. Needs Node 22.5 or newer, plus `uvx` (from uv) and `npx` for the third-party MCP servers.

```
pnpm install
cp .env.example .env     # add OPENAI_API_KEY (and optionally POLYGON_API_KEY, BRAVE_API_KEY, PUSHOVER_*, provider keys)
pnpm lab1                # Day 1: Fetch, Playwright and Filesystem MCP servers; the investigator writes sandbox/banoffee.md
pnpm mcp-check           # Day 2 without any model: our accounts MCP server + hand-written client, buy/sell over MCP
pnpm lab2                # Day 2: accounts.ts, accounts_server.ts as an MCP server, accounts_client.ts
pnpm lab3                # Day 3: memory, Brave search (needs BRAVE_API_KEY), market server (pnpm lab3 memory|brave|market|polygon)
pnpm count-tools         # Day 4: start every trader/researcher MCP server and count the tools (no model needed)
pnpm lab4                # Day 4: one trader, Ed, with traders.ts
pnpm reset               # Day 5: Warren, George, Ray and Cathie back to $10,000 with their strategies
pnpm trading-floor       # Day 5: the four traders every RUN_EVERY_N_MINUTES (RUN_ONCE=true for a single round)
pnpm api                 # Day 5: Hono API on :8791 (serves web/dist after pnpm build)
pnpm web                 # Day 5: React dev server on :5173 (proxies /api)
pnpm build               # type-check + build the React dashboard
```

Without an OpenAI key, run against a local Ollama model (small local models struggle with this many tools):

```
OPENAI_BASE_URL=http://localhost:11434/v1 OPENAI_API_KEY=ollama MODEL=llama3.2 pnpm lab2
```

## Demo data

`pnpm seed-demo` fills `accounts.db` with **demo data**: it resets the four traders, buys a few shares for each through
the real `accounts.ts` code and back-fills a week of portfolio values from stand-in prices. No agent made those
decisions; every seeded transaction says `[DEMO]` and each log starts with a "DEMO DATA" line. The dashboard
screenshots in the guide that show these columns are demo data. `pnpm reset` clears it.

## Stand-ins and differences

- No `POLYGON_API_KEY`: `market.ts` returns **stand-in prices** (a fixed table plus a small daily wobble; unknown symbols
  get 1–100), not market data. The course returns a new random number on every call instead.
- No `BRAVE_API_KEY`: the Brave search server is left out (it exits at start-up without a key).
- No Pushover keys: the push tool only prints the message.
- Our own servers start with `node --import tsx src/<file>.ts` where the course uses `uv run <file>.py`.
- The course asks Windows users to use WSL for MCP; Node starts `npx`/`uvx` servers fine on Windows.
