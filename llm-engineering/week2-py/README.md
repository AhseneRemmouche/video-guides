# Week 2 (LLM Engineering) - Local Ollama edition

This is Week 2 of Ed Donner's **LLM Engineering** course, adapted so every call
runs against a **local Ollama server** instead of paid frontier models. It is
free to run and needs no cloud API keys.

> Honesty note: the real course uses paid frontier models (OpenAI, Anthropic,
> Google...) plus real image generation (DALL-E 3) and text-to-speech (tts-1).
> This project proves the *code* runs end-to-end against a local model. Quality
> and behavior of a small local model will differ from the course's frontier
> models, and the image/audio day is intentionally not run (no local model).

## Requirements

- [Ollama](https://ollama.com) running at `http://localhost:11434`
- Models pulled locally:
  - `llama3.2` (default)
  - a working second model for the adversarial chat in day1. `qwen3.5:9b` was
    intended, but on the test server it is listed yet fails to load
    ("not found, try pulling it first"), so `MODEL_B` defaults to `dolphin3:8b`.
    Set `MODEL_B` in `.env` to whatever second model you have.
- [uv](https://docs.astral.sh/uv/)

## Setup

```bash
cp .env.example .env        # defaults already point at local Ollama
uv sync
```

If `uv sync` fails on corporate TLS / certificate errors, retry with:

```bash
UV_NATIVE_TLS=1 uv sync
```

## How it connects

Every script uses the OpenAI SDK pointed at Ollama's OpenAI-compatible endpoint:

```python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")
client.chat.completions.create(model="llama3.2", messages=...)
```

## Run (one at a time - the shared Ollama may queue)

```bash
uv run python src/day1_apis.py        # two models, streaming, adversarial chat
uv run python src/day3_chatbot.py     # chat(message, history, system), keeps context
uv run python src/day4_tools.py       # get_ticket_price tool + tool-call loop (+ fallback)
uv run python src/day5_multimodal.py  # NOT RUN - no local image/audio model
```

Prompts and outputs are kept short (`max_tokens ~120`) so runs are fast.

## Files

- `src/common.py` - shared Ollama client + helpers
- `src/day1_apis.py` - "multiple providers" routed to Ollama: `llama3.2` and
  a second local model (`MODEL_B`), a streaming helper, and a 3-turn
  adversarial conversation between the two local models
- `src/day3_chatbot.py` - `chat(message, history, system)` with a scripted
  conversation that shows history is kept
- `src/day4_tools.py` - `get_ticket_price(city)` as a JSON-schema tool with the
  full tool-call loop; detects if the local model actually tool-called and
  falls back to a direct function call if not
- `src/day5_multimodal.py` - explains that image/audio need paid cloud models
  and shows the guarded code path (not run)
