# Week 4 (Python) - LangGraph examples

Runnable LangGraph examples from Week 4 of Ed Donner's Agentic AI course, wired to a
**local Ollama** model so they run with no API key and no cost.

## What's here

| File | What it shows |
| --- | --- |
| `common.py` | Builds a `ChatOpenAI` pointed at Ollama (`http://localhost:11434/v1`, model `llama3.2`). |
| `lab2_chatbot.py` | A `StateGraph` chatbot with the `add_messages` reducer (lab 2). |
| `lab3_tools_memory.py` | `ToolNode` + `tools_condition` + conditional edges + a checkpointer (`MemorySaver`/`SqliteSaver`) with a `thread_id` so the graph remembers across turns (lab 3). |
| `sidekick.py` | A slimmed worker/evaluator loop with structured output, same graph shape as the course's Sidekick, using safe local tools instead of Playwright (lab 4). |

## Prerequisites

* [uv](https://docs.astral.sh/uv/) installed.
* [Ollama](https://ollama.com/) running locally with the model pulled:
  `ollama pull llama3.2`

## Install

On this machine, `uv sync` needs native TLS or it fails with an "UnknownIssuer" error:

```bash
UV_NATIVE_TLS=1 uv sync
```

The browser tools (Playwright) are an **optional** extra and are not needed for the
runnable core:

```bash
UV_NATIVE_TLS=1 uv sync --extra browser   # only if you want the course's Playwright tools
```

## Run

```bash
uv run python src/lab2_chatbot.py
uv run python src/lab3_tools_memory.py
CHECKPOINTER=sqlite uv run python src/lab3_tools_memory.py   # file-backed memory
uv run python src/sidekick.py
```

See `RUN-NOTES.md` for real captured output.
