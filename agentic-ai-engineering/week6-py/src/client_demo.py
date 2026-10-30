"""
Week 6 MCP demo client.

Two things happen here:

  1. An OpenAI Agents SDK `Agent` launches our `accounts_server.py` as an MCP
     server over stdio (`MCPServerStdio`), lists its tools, and is asked to check
     a balance and buy some shares. The agent runs on a LOCAL Ollama model
     (llama3.2) -- no paid API, no OpenAI key.

  2. A DIRECT (non-agent) MCP client session then calls the same tools straight
     over stdio. Small local models call tools inconsistently; this direct path
     proves the MCP server itself works regardless of what the model decides.

Run:  UV_NATIVE_TLS=1 uv sync   (once)
      uv run python src/client_demo.py
"""

import asyncio
import sys
from pathlib import Path

# Windows consoles default to cp1252; model output can contain other characters.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

# --- Windows/uv OpenSSL workaround (safe here) ------------------------------
# On this machine the uv-managed CPython 3.12 build hard-aborts with
# "OPENSSL_Uplink ... no OPENSSL_Applink" whenever OpenSSL loads its default
# certificate paths (e.g. ssl.create_default_context()). openai-agents 0.2.x
# creates such a context at import time. We never use TLS -- the agent talks to
# Ollama over plain http://localhost -- so we neutralise default-context
# creation BEFORE importing the SDK. No HTTPS handshake ever happens, so the
# returned (unverified) context is never actually used. On a normal machine
# this block is a harmless no-op you can delete.
import ssl as _ssl


def _safe_default_context(*_args, **_kwargs):
    ctx = _ssl.SSLContext(_ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = _ssl.CERT_NONE
    return ctx


_ssl.create_default_context = _safe_default_context
# ---------------------------------------------------------------------------

import mcp
from mcp import StdioServerParameters
from mcp.client.stdio import stdio_client

from openai import AsyncOpenAI
from agents import (
    Agent,
    Runner,
    set_default_openai_client,
    set_default_openai_api,
    set_tracing_disabled,
    OpenAIChatCompletionsModel,
)
from agents.mcp import MCPServerStdio

# --- point the Agents SDK at local Ollama (OpenAI-compatible chat API) ------
OLLAMA_BASE_URL = "http://localhost:11434/v1"
MODEL_NAME = "llama3.2"

client = AsyncOpenAI(base_url=OLLAMA_BASE_URL, api_key="ollama")  # key is a dummy
set_default_openai_client(client)
set_default_openai_api("chat_completions")
set_tracing_disabled(True)  # hosted tracing is OpenAI-only; we have no key

# --- how to launch our MCP server over stdio --------------------------------
HERE = Path(__file__).resolve().parent
SERVER_SCRIPT = HERE / "accounts_server.py"
# Use THIS interpreter (already the uv venv's python) and run the server with
# cwd=src so its `from accounts import Account` import resolves.
STDIO_PARAMS = {"command": sys.executable, "args": [str(SERVER_SCRIPT)], "cwd": str(HERE)}

ACCOUNT = "ed"


async def direct_tool_calls() -> None:
    """Call the server's tools directly (no LLM), to prove the server works."""
    params = StdioServerParameters(command=sys.executable, args=[str(SERVER_SCRIPT)], cwd=str(HERE))
    async with stdio_client(params) as (read, write):
        async with mcp.ClientSession(read, write) as session:
            await session.initialize()
            tools = (await session.list_tools()).tools
            print("Tools exposed by the MCP server:", [t.name for t in tools])

            bal = await session.call_tool("get_balance", {"name": ACCOUNT})
            print("get_balance ->", bal.content[0].text)

            buy = await session.call_tool(
                "buy_shares",
                {"name": ACCOUNT, "symbol": "AAPL", "quantity": 5,
                 "rationale": "Direct MCP call demo"},
            )
            print("buy_shares(5 AAPL) ->", buy.content[0].text[:200], "...")

            holdings = await session.call_tool("get_holdings", {"name": ACCOUNT})
            print("get_holdings ->", holdings.content[0].text)

            res = await session.read_resource(f"accounts://accounts_server/{ACCOUNT}")
            print("resource report ->", res.contents[0].text[:200], "...")


async def agent_run() -> None:
    """Let a local-Ollama agent drive the MCP server's tools."""
    async with MCPServerStdio(params=STDIO_PARAMS, client_session_timeout_seconds=60) as server:
        tools = await server.list_tools()
        print("Agent sees MCP tools:", [t.name for t in tools])

        agent = Agent(
            name="account_manager",
            instructions=(
                "You manage a stock trading account via the provided tools. "
                "Always use the tools to read or change the account; never make up "
                "numbers. The account holder's name is 'ed'."
            ),
            model=OpenAIChatCompletionsModel(model=MODEL_NAME, openai_client=client),
            mcp_servers=[server],
        )
        request = (
            "My name is ed. First tell me my current balance, then buy 5 shares of "
            "AAPL with the rationale 'long-term hold', then tell me my holdings."
        )
        result = await Runner.run(agent, request, max_turns=12)

        # Show exactly which MCP tools the AGENT decided to invoke (proof the
        # agent -> MCP tool path fired, independent of the final text quality).
        tool_calls = []
        for item in result.new_items:
            if type(item).__name__ == "ToolCallItem":
                raw = getattr(item, "raw_item", None)
                name = getattr(raw, "name", None)
                args = getattr(raw, "arguments", None)
                if name:
                    tool_calls.append(f"{name}({args})")
        print("Agent invoked MCP tools:", tool_calls or "(none this run)")

        print("\n--- Agent final output ---")
        print(result.final_output)


async def main() -> None:
    print(f"=== Week 6 MCP demo (agent model={MODEL_NAME} on local Ollama) ===\n")

    print("[1] Agent -> MCP server over stdio")
    try:
        await agent_run()
    except Exception as exc:  # noqa: BLE001 -- demo: report and continue to direct proof
        print(f"(agent run raised: {type(exc).__name__}: {exc})")

    print("\n[2] Direct MCP tool calls over stdio (no LLM) -- proves the server works")
    await direct_tool_calls()


if __name__ == "__main__":
    asyncio.run(main())
