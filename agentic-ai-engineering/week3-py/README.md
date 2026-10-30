# Week 3 — CrewAI `stock_picker` crew (local Ollama build)

This is the Week 3 project from the Agentic AI guide: Ed Donner's **stock_picker**
CrewAI crew, adapted to run **fully locally and free** against [Ollama](https://ollama.com).
It keeps the real course structure — `@CrewBase`, agents/tasks defined in YAML,
Pydantic structured outputs (`output_pydantic`), a **hierarchical** process with a
**manager agent**, and the three memory types — but swaps every paid/keyed piece
for a local or offline equivalent.

## What the crew does

A manager agent delegates three tasks to three worker agents:

1. **trending_company_finder** → finds 2–3 trending companies in a sector
   (`output_pydantic=TrendingCompanyList`).
2. **financial_researcher** → researches each one
   (`output_pydantic=TrendingCompanyResearchList`).
3. **stock_picker** → picks the best company, "sends" a push notification, and
   writes a decision report.

## Layout

```
src/stock_picker/
  crew.py              # @CrewBase crew: agents, tasks, Pydantic models, memory, hierarchical process
  main.py              # entrypoint: sets Ollama env, then kicks off the crew
  config/agents.yaml   # roles / goals / backstories  (llm: ollama/llama3.2)
  config/tasks.yaml    # task descriptions + expected_output + output_file
  tools/push_tool.py   # PushNotificationTool — logs instead of calling Pushover
  tools/search_tool.py # WebSearchStubTool — offline stand-in for SerperDevTool
```

## Changes from the course (honest list)

| Course (paid/keyed)                         | This local build                                             |
|---------------------------------------------|--------------------------------------------------------------|
| `openai/gpt-4o-mini` / `openai/gpt-4o`      | `ollama/llama3.2` for every agent (free, local)              |
| `SerperDevTool()` web search (`SERPER_API_KEY`) | `WebSearchStubTool` — no network; tells the agent to use its own knowledge |
| Pushover push notification (`PUSHOVER_*`)   | `PushNotificationTool` prints the message to stdout          |
| OpenAI embeddings for memory                | Ollama `nomic-embed-text` embeddings (RAG storage)           |

The **structure** (hierarchical manager, Pydantic outputs, three memory types)
is preserved exactly as in the course.

## Prerequisites

- [uv](https://docs.astral.sh/uv/) installed.
- Ollama running at `http://localhost:11434` with `llama3.2` and
  `nomic-embed-text` pulled:
  ```
  ollama pull llama3.2
  ollama pull nomic-embed-text
  ```

## Run

```bash
# This machine needs native TLS for uv (corporate cert chain):
UV_NATIVE_TLS=1 uv sync

uv run python -m stock_picker.main
# or, via the installed script:
uv run stock_picker
```

Outputs are written under `output/` (`trending_companies.json`,
`research_report.json`, `decision.md`). Memory lives under `memory/`.

Run without memory (skips embeddings entirely):

```bash
STOCK_PICKER_MEMORY=0 uv run python -m stock_picker.main
```

## Caveats

`llama3.2` is a small local model. Hierarchical delegation and strict Pydantic/
JSON formatting are hard for small models, so picks and formatting may be weaker
than the course's GPT-4o output. That is expected — the point here is that the
crew wiring runs end-to-end locally and free. See `RUN-NOTES.md` for the actual
captured run.
