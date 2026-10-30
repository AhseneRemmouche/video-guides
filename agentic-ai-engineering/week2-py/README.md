# Week 2 — OpenAI Agents SDK, run against LOCAL Ollama

A runnable `uv` project reproducing Week 2 of Ed Donner's *Agentic AI Engineering*
course (the **OpenAI Agents SDK**), but pointed at a **local Ollama** server
instead of the OpenAI cloud. No OpenAI API key, no network calls.

## What's honest / what differs from the course

The course runs the Agents SDK on **OpenAI** (`gpt-4o-mini` etc.), uses the
**hosted `WebSearchTool`**, and the **OpenAI tracing dashboard**. None of that is
reproduced here. Instead:

- Every `Agent` uses `OpenAIChatCompletionsModel(model="llama3.2", ...)` bound to
  an `AsyncOpenAI` client pointed at `http://localhost:11434/v1`.
- The SDK is repointed and tracing is switched off (see `src/ollama_setup.py`):
  ```python
  set_default_openai_client(AsyncOpenAI(base_url="http://localhost:11434/v1", api_key="ollama"))
  set_default_openai_api("chat_completions")
  set_tracing_disabled(True)
  ```
- The hosted **`WebSearchTool` is OpenAI-only**, so `research.py` **replaces it
  with a canned `@function_tool`** that returns fixed text. The research team
  therefore proves the *orchestration* runs locally — it does **not** actually
  search the web.
- `llama3.2` is a 3B local model. It is far weaker than the course's frontier
  models at multi-step tool use and strict JSON, so some runs are rougher. This
  project proves the **SDK code runs locally**, not that a small model matches
  GPT-4o.

## Setup

```bash
uv sync                 # create venv + install deps
# if TLS/cert errors:  UV_NATIVE_TLS=1 uv sync
cp .env.example .env    # optional; defaults already target localhost:11434
ollama pull llama3.2    # make sure the model is present
```

## Run

```bash
uv run python src/day1_agent.py
uv run python src/day2_tools.py
uv run python src/day3_structured.py
uv run python src/research.py
```

## Scripts

- `src/day1_agent.py` — a first `Agent` + `Runner.run`; prints the result.
- `src/day2_tools.py` — a `@function_tool` (canned "send email"), an agent used
  as a tool (`.as_tool`), and a handoff between two agents.
- `src/day3_structured.py` — an `Agent` with `output_type=<Pydantic model>`
  (structured output); retries once with a simpler prompt if the small model
  emits invalid JSON, and says so.
- `src/research.py` — planner → canned search tool → writer, orchestrated by a
  manager; runs one query and prints a short report.
- `src/ollama_setup.py` — shared Ollama wiring used by all scripts.
