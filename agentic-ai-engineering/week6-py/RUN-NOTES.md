# RUN-NOTES — week6-py (honest record)

## Environment
- Windows 11, uv 0.11.7, CPython 3.12 (uv-managed).
- Local **Ollama** at `http://localhost:11434`, model **`llama3.2:latest`** (confirmed present).
- Resolved deps: `mcp==1.30.0` (FastMCP lives here in v1; v2 renamed it to `MCPServer`,
  so the project pins `mcp<2`), `openai-agents==0.2.11`, `openai==1.109.1`, `pydantic==2.14.2`.
- **No paid APIs used.** No Polygon, no Brave, no OpenAI/Anthropic cloud.

## Commands run
```
UV_NATIVE_TLS=1 uv sync                 # succeeded (UV_NATIVE_TLS=1 required, else TLS UnknownIssuer)
uv run python src/accounts.py           # business-logic self-test: OK
uv run python src/client_demo.py        # agent + direct MCP calls: OK
```

## What the MCP server exposes
Tools: `get_balance`, `get_holdings`, `buy_shares`, `sell_shares`.
Resource: `accounts://accounts_server/{name}` (read-only JSON account report).

## Was the MCP server + agent run against Ollama? YES.
The OpenAI Agents SDK agent (model `llama3.2` on local Ollama) launched
`accounts_server.py` as a subprocess over **stdio** via `MCPServerStdio`, listed its
tools, and **actually invoked them**. Real captured output from one run:

```
[1] Agent -> MCP server over stdio
Agent sees MCP tools: ['get_balance', 'get_holdings', 'buy_shares', 'sell_shares']
Agent invoked MCP tools: ['get_balance({"name":"ed"})', 'buy_shares({"symbol":"AAPL","quantity":"5","rationale":"long-term hold","name":"ed"})', 'get_holdings({"name":"ed"})']

--- Agent final output ---
Your current balance is $9,048.10. You have successfully purchased 5 shares of AAPL
with a rationale of "long-term hold". Your current holdings are 5 shares of AAPL.
```

The FastMCP server also logs each request to stderr; that run showed
`Processing request of type ListToolsRequest` / `CallToolRequest` / `ReadResourceRequest`,
confirming the calls reached the server process.

## Direct (non-agent) proof — always included
Because small local models call tools inconsistently, `client_demo.py` ALSO opens a
direct MCP client session and calls the tools itself, so the server is proven
regardless of the model. Real captured output:

```
[2] Direct MCP tool calls over stdio (no LLM) -- proves the server works
Tools exposed by the MCP server: ['get_balance', 'get_holdings', 'buy_shares', 'sell_shares']
get_balance -> 9048.1
buy_shares(5 AAPL) -> Completed. {"name": "ed", "balance": 8096.20..., "holdings": {"AAPL": 10}, ...}
get_holdings -> { "AAPL": 10 }
resource report -> {"name": "ed", "balance": 8096.20..., "holdings": {"AAPL": 10}, ...}
```
(The balance/holdings carry over from the agent phase because both phases share the
same SQLite account file — this also demonstrates the store persisting state.)

## Honest caveats
- **Market prices are FAKE.** `accounts.py::get_share_price` returns fixed invented
  prices (AAPL=190, etc.). The real course uses Polygon.io, which needs a paid key
  and was **not** run here. Noted in a code comment.
- **Small-model inconsistency is real.** `llama3.2` is a small model. In the run quoted
  above it called all three tools and answered coherently; in other runs it sometimes
  emits the raw tool-call JSON as its final message instead of a tidy sentence. The
  agent→tool path still fires; the direct-call section is there precisely so the server
  is verified even on a bad model run.
- **Not run:** the full multi-agent **Trading Floor** (`traders.py`, `trading_floor.py`,
  the Gradio app, the market MCP server, Brave search, push notifications). That system
  needs Polygon/Brave keys and runs on a long schedule; it is shown in the guide as in
  the course, not executed here. This project verifies only the piece that matters for
  the MCP lesson: **building an MCP server and having an agent call its tools over stdio.**
- **Windows/OpenSSL workaround.** This uv-managed CPython build hard-aborts
  (`OPENSSL_Uplink ... no OPENSSL_Applink`) whenever OpenSSL loads default certificate
  paths, and `openai-agents` 0.2.x creates an SSL context at import time. Since the demo
  only talks to Ollama over plain `http://localhost` (no TLS), `client_demo.py` neutralises
  default-context creation before importing the SDK (clearly commented). No HTTPS handshake
  ever happens, so this is safe here; on a normal machine the shim is a no-op.
