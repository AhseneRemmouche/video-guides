# RUN-NOTES — Week 5 (Python, AutoGen) against local Ollama

Honest record of what was actually run on this Windows 11 machine, what the
models actually produced, what was skipped, and the one environment workaround
that was needed.

- **Date:** 2026-10-30
- **Machine:** Windows 11, `uv` 0.11.7, Python 3.12.12 (uv-managed)
- **LLM backend:** LOCAL Ollama at `http://localhost:11434`, model `llama3.2`
  (3.2B, `tools` capability). No paid API was used anywhere.
- **AutoGen:** `autogen-agentchat`/`autogen-core`/`autogen-ext` **0.7.5**,
  `pydantic` 2.14.2.

## Install

```
UV_NATIVE_TLS=1 uv sync
```

`UV_NATIVE_TLS=1` is required on this machine (otherwise `uv` fails the TLS
handshake with `UnknownIssuer`). `uv sync` resolved and installed cleanly
(exit 0), pulling autogen-* 0.7.5, ollama 0.6.3, openai 3.41.0, httpx, etc.

## Environment workaround (honest caveat)

This machine's bundled OpenSSL (OpenSSL 3.5.4, shipped with the uv-managed
CPython) is broken in a specific way: the moment any code loads CA certificates
it aborts natively with

```
OPENSSL_Uplink(00007FFB05AA7C58,08): no OPENSSL_Applink
```

This fires from `ssl.create_default_context()`, `SSLContext.load_default_certs()`
and `load_verify_locations()`. Because `httpx` builds a default TLS context when
a client is constructed, this crashed **even a plain `http://localhost` request**
— and therefore crashed `import ollama` and any `OllamaChatCompletionClient`
call. It is not a PATH / foreign-DLL collision: it reproduces from both
PowerShell and Git Bash, with Git/mingw and Ollama scrubbed from PATH, and even
when the uv-Python's own `libcrypto-3-x64.dll` is preloaded by absolute path.
A *bare* `SSLContext(PROTOCOL_TLS_CLIENT)` with no cert loading constructs fine.

Fix used: `src/_ssl_localhost_patch.py`, imported first in both labs, neutralises
*only* the three CA-cert-loading calls (returns a bare unverified context /
no-ops the loaders). We only ever talk to **local Ollama over plain HTTP**, so no
TLS handshake ever happens and nothing is actually left unverified on the wire.
This is a workaround for a broken local OpenSSL build; it is clearly labelled in
the module and is not something you'd ship to production.

## Lab 1 — AgentChat basics + a tool (`src/lab1_agentchat.py`)

Command (runs in any shell once the shim is in place):

```
uv run python src/lab1_agentchat.py
```

Real output captured (also saved to `out/lab1_agentchat.txt`):

```
== Using local Ollama model: llama3.2 ==

--- Part 1: plain agent ---
London, where the tea is strong, the accents are stronger, and the queuing is an art form. Book that ticket, mate!

(sanity check) get_city_price('Rome') = 499.0

--- Part 2: tool-using agent (inner events) ---
[ToolCallRequestEvent] [FunctionCall(id='0', arguments='{"city_name": "London"}', name='get_city_price')]
[ToolCallExecutionEvent] [FunctionExecutionResult(content='299.0', name='get_city_price', call_id='0', is_error=False)]

--- Part 2: final answer ---
That's a pretty penny for a pint of tea, but a round-trip ticket to London will set you back about $299. Don't worry, it's worth it for a spot of tea and a dose of British charm.

>> Did the model actually invoke the get_city_price tool this run? True
```

**Result:** ran fully against Ollama. On this run the model **did** call the
`get_city_price` tool: you can see the `ToolCallRequestEvent` →
`ToolCallExecutionEvent` (returning `299.0`), and the final answer quotes $299,
which matches the SQLite row for London.

**Honest caveat:** `llama3.2` is small and calls tools *inconsistently*. On some
runs it skips the tool and just narrates a made-up price; the script detects this
and prints `Did the model actually invoke the ... tool this run? False` with a
note. The run above is a good one. Re-running can produce either behaviour.

## Lab 3 — AutoGen Core message passing (`src/lab3_core.py`)

Command:

```
uv run python src/lab3_core.py
```

Real output captured (also saved to `out/lab3_core.txt`):

```
== Using local Ollama model: llama3.2 ==

--- Part 1: SimpleAgent (no LLM) ---
>>> This is simple_agent-default. You said 'Well hi there!' and I disagree.

--- Part 2: rock-paper-scissors (all Ollama) ---
Player 1: rock
Player 2: scissors
Since Player 2 chose scissors and Player 1 chose rock, according to the rock-paper-scissors rules, rock beats scissors. Therefore, Player 1 wins this round.
```

**Result:** ran fully. Part 1 shows the `RoutedAgent` / `@message_handler` /
`SingleThreadedAgentRuntime` lifecycle with no LLM. Part 2 shows three agents
talking over the runtime (a referee `send_message`-ing two players, then an LLM
judging) — **all three backed by local Ollama** (the course used OpenAI for
player 1; here everything is Ollama).

**Honest caveat:** the small model is not a reliable referee. On the run above
the verdict is correct (rock beats scissors). On a second run it produced:

```
Player 1: paper
Player 2: scissors
Since Player 1 chose paper and Player 2 chose scissors, paper covers scissors, making Player 1 the winner.
```

— which is **wrong** (scissors cuts paper; Player 2 should win). The players also
sometimes add extra words despite the "one word only" instruction. The runtime
and message-passing mechanics are solid; the *quality* of a 3.2B model's judgement
is not. That is the honest reality of running these labs on a small local model.

## What was NOT run here (shown as in the course, not executed)

- **Lab 2** (`code/w5/2_lab2_autogen_agentchat.py`) — multimodal messages,
  structured Pydantic output, a primary/evaluator pair, and an **MCP fetch
  server**. Not part of the required runnable set; needs the MCP server and
  web access, and multimodal depends on a vision model. Shown in the guide, not
  run here.
- **Lab 4 — distributed gRPC runtime** (`code/w5/4_lab4_autogen_distributed.py`):
  `GrpcWorkerAgentRuntime` + `GrpcWorkerAgentRuntimeHost`, agents across
  processes talking over a gRPC host, plus a LangChain tool adapter. This needs
  extra infrastructure (a running gRPC host and multiple worker processes), so
  per the brief it is **documented as in the course but not run** in this
  project.
- **Lab 5 — the "world" capstone** (`code/w5/5_autogen__{world,creator,agent,messages}.py`):
  a `Creator` agent that writes new `agentN.py` files and deploys them over the
  gRPC runtime. Same reason — distributed infra + self-writing agents — **not
  run here**, shown as in the course.

## Summary

| Item | Status |
| --- | --- |
| `UV_NATIVE_TLS=1 uv sync` | OK (exit 0), autogen 0.7.5 |
| `lab1_agentchat.py` vs Ollama | RAN; tool actually invoked this run |
| `lab3_core.py` vs Ollama | RAN; runtime + 3 Ollama agents; judge sometimes wrong |
| Lab 2 (multimodal/MCP) | Not run (not required; needs MCP server + vision) |
| Lab 4 (gRPC distributed) | Not run (needs gRPC host + worker processes) |
| Lab 5 ("world" capstone) | Not run (distributed infra) |
| Paid APIs | None used |
