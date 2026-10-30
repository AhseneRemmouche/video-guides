# Week 6 (Python): build your own MCP server + an agent that uses it

This is the runnable project for Week 6 (MCP — the Model Context Protocol) of the
Agentic AI guide. It demonstrates the core Week 6 idea in miniature:

1. **Build your own MCP server** with `FastMCP` — plain Python functions become
   MCP *tools* and *resources*.
2. **Let an agent use it.** An OpenAI Agents SDK `Agent` launches the server as a
   subprocess over **stdio** (`MCPServerStdio`), discovers its tools, and calls
   them to do a task.

It is a trimmed version of Ed Donner's trading-floor "accounts" system. It runs
with **no paid API keys**: the agent uses a **local Ollama** model (`llama3.2`),
and market prices are **faked** (see below).

## Files (`src/`)

| File | What it is |
|------|------------|
| `accounts.py` | A simplified `Account` business-logic class (balance, buy/sell shares, holdings, a JSON report) backed by a local SQLite file. **Market prices are fake/fixed** — the real course calls Polygon.io (paid key); here `get_share_price` returns a made-up fixed price per symbol so it runs offline. |
| `accounts_server.py` | `FastMCP("accounts_server")` exposing `@mcp.tool()` `get_balance`, `get_holdings`, `buy_shares`, `sell_shares`, and an `@mcp.resource(...)` returning the account report. Runs with the stdio transport. |
| `client_demo.py` | (1) An `Agent` on local Ollama that launches `accounts_server.py` via `MCPServerStdio`, lists its tools, and runs a short task; (2) a **direct** (non-agent) MCP client session that calls the same tools over stdio, proving the server works regardless of what the small model decides. |

## Run it

Prerequisites: [uv](https://docs.astral.sh/uv/), and [Ollama](https://ollama.com/)
running locally with the model pulled:

```bash
ollama pull llama3.2
```

Then, from this folder:

```bash
# On this Windows machine, uv sync needs native TLS:
UV_NATIVE_TLS=1 uv sync

# Run the demo (agent + direct proof):
uv run python src/client_demo.py
```

You can also run the business logic on its own (no agent, no MCP):

```bash
uv run python src/accounts.py
```

See **RUN-NOTES.md** for a captured real run and honest caveats.

## In TypeScript

MCP itself is language-neutral: there is an official TypeScript MCP SDK
(`@modelcontextprotocol/sdk`) with the same tools/resources model, and the
OpenAI Agents SDK for JavaScript can consume MCP servers too. This project is
Python only because the course's trading-floor code is Python; the concepts map
directly. The `week6-ts/` folder is a small **demo UI** (a sample portfolio), not
a port of this server.
