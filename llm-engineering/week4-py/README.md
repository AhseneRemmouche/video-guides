# Week 4 — Python → C++ code optimizer (local Ollama)

A runnable, trimmed-down version of Ed Donner's LLM Engineering **Week 4** code
optimizer. You give the model a slow piece of Python and it rewrites it as fast
C++. This project runs entirely against a **local Ollama** model — no cloud API
keys, no cost.

## What this does (and doesn't)

- `src/optimize.py` — sends a slow sample Python function (a loop summing numbers)
  to the local model with the system prompt *"Rewrite this Python in C++ for
  maximum speed; reply with only the C++ code."*, **streams** the reply, strips
  any ```` ```cpp ```` fences, and prints the generated C++.
- `src/compile_note.py` — explains the compile + time step and prints the exact
  `g++` / `clang++` commands you would use.

> **No C++ compiler on this machine.** The course compiles the generated C++ and
> times it against the Python to show a real speedup. There is no `g++`/`clang++`
> here, so this project **only generates** the C++ — the compile + time step is
> skipped. See `compile_note.py`.

> **Honest note on quality.** The course uses GPT-4o / Claude for high-quality
> C++ and measures large speedups. Here we use a small local model
> (`llama3.2:latest`), so the generated C++ may be rough — the point is to verify
> that the **generation pipeline runs** against a local model, not to match the
> course's output quality.

## Requirements

- [Ollama](https://ollama.com) running at `http://localhost:11434`
- A model pulled, e.g. `ollama pull llama3.2:latest` (or `qwen3.5:9b`)
- [uv](https://docs.astral.sh/uv/)

## Setup & run

```bash
cp .env.example .env          # defaults already point at local Ollama
uv sync                       # if TLS errors: UV_NATIVE_TLS=1 uv sync
uv run python src/optimize.py # generate C++ from the sample Python
uv run python src/compile_note.py
```

Switch models by editing `OPTIMIZE_MODEL` in `.env` (e.g. `qwen3.5:9b`).

## Connection details

Ollama exposes an OpenAI-compatible API at `/v1`, so the standard OpenAI client
works with just a base URL and any non-empty key:

```python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")
```
