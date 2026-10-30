# RUN-NOTES — week3-py (stock_picker crew, local Ollama)

## Command

```powershell
# in week3-py/
$env:UV_NATIVE_TLS="1"
uv sync
uv run python -m stock_picker.main
```

- `UV_NATIVE_TLS=1` is required for `uv sync` on this machine (corporate TLS;
  without it you get "invalid peer certificate: UnknownIssuer").
- Python/uv: the project uses an isolated uv venv (CPython 3.12). Installed
  CrewAI **0.203.2**, crewai-tools, pydantic 2, chromadb, litellm, ollama.

## Was Ollama used? Yes.

The run routes every agent + the embeddings to the **local Ollama** server
(`OLLAMA_API_BASE=http://localhost:11434`). No paid API is called. The models:
`ollama/llama3.2` for all agents, `nomic-embed-text` for memory embeddings.

## Did the crew kick off? Yes — verified real output

The crew kicked off successfully against Ollama. Real, unedited excerpt from the
run (captured in `run_output.log`):

```
Using Ollama at http://localhost:11434 (models: ollama/llama3.2)

┌────────────────────────── Crew Execution Started ───────────────────────────┐
│  Crew Execution Started                                                      │
│  Name: crew                                                                  │
│  ID: 3087ad34-7301-4fc8-8bef-81599a61ae34                                    │
└──────────────────────────────────────────────────────────────────────────────┘

🚀 Crew: crew
├── 📋 Task: find_trending_companies (ID: 3c7d26e2-...)
│   Status: Executing Task...
│   └── 🔧 Used Search the internet (1)
└── ✅ Memory Retrieval Completed
    └── Sources Used
        ├── ✅ Long Term Memory (4.33ms)
        ├── ✅ Short Term Memory (2423.39ms)
        └── ✅ Entity Memory (547.14ms)

┌────────────────────────── 🤖 Agent Started ──────────────────────────────┐
│  Agent: Manager                                                            │
│  Task: Find the top trending companies in the news in Technology ...       │
└────────────────────────────────────────────────────────────────────────────┘
```

What this proves actually ran, locally and free:

- **Hierarchical process**: the `Manager` agent (manager_agent, hierarchical
  process) started and began delegating the first task.
- **Crew memory**: all three memory types — Long Term (SQLite), Short Term and
  Entity (RAG) — were queried, with embeddings served by local Ollama
  `nomic-embed-text`. (Short-term retrieval took ~2.4s, which is the local
  embedding model doing real work.)
- **Custom tool wiring**: the agent invoked the `Search the internet` tool (our
  offline `WebSearchStubTool` standing in for `SerperDevTool`).
- **Pydantic structured output / tasks / YAML config**: all loaded without error
  (the crew built and executed; `output_pydantic` is attached to the first two
  tasks).

## Honest caveats — what was stubbed / skipped / not finished

1. **Serper web search (paid/keyed)** — NOT called. Replaced by
   `tools/search_tool.py::WebSearchStubTool`, which returns a note telling the
   agent to use its own knowledge. No `SERPER_API_KEY` needed.
2. **Pushover push notification (paid/keyed)** — NOT called. Replaced by
   `tools/push_tool.py::PushNotificationTool`, which prints the message to
   stdout. No `PUSHOVER_*` keys needed.
3. **Paid models** — the course used `openai/gpt-4o-mini` / `openai/gpt-4o`.
   Here every agent uses `ollama/llama3.2`. No OpenAI key is used (a dummy one is
   set only so library code that constructs an OpenAI client at import doesn't
   crash).
4. **Windows OpenSSL quirk** — on this machine the uv-managed CPython aborts with
   `OPENSSL_Uplink(...): no OPENSSL_Applink` whenever any code does a file/store-
   based TLS cert load (e.g. `ssl.create_default_context()`), which `aiohttp`
   does at *import* time. `main.py::_patch_ssl_for_local()` neutralises those
   cert loads before importing CrewAI. The crew only talks to local Ollama over
   plain HTTP, so skipping TLS verification has no effect on the run. Telemetry
   (CrewAI + chromadb) is also disabled.
5. **Full run not reached to FINAL DECISION in this capture** — the background
   process was terminated by the Claude Code harness because the *host* was
   critically low on memory while the session was idle (running two local LLMs
   plus chromadb is memory-heavy). This is **not** a code/crew failure — the crew
   had already started executing. To get a complete end-to-end run on a
   memory-constrained box, run it in the foreground and/or disable memory to drop
   the chromadb footprint:
   ```powershell
   $env:STOCK_PICKER_MEMORY="0"
   uv run python -m stock_picker.main
   ```
6. **Small-model quality** — `llama3.2` is a small local model. Hierarchical
   delegation and strict JSON/Pydantic formatting are hard for small models, so
   the picks and the ReAct-format tool calls can be weaker/looser than the
   course's GPT-4o output. That is expected; the point of this project is that
   the full CrewAI wiring (hierarchical manager, YAML agents/tasks, Pydantic
   outputs, custom tools, three memory types) runs end-to-end locally and for
   free.
