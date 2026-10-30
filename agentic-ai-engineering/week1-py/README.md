# Week 1 - Foundations (runs on LOCAL Ollama, free)

A runnable Python port of Week 1 of Ed Donner's Agentic AI Engineering course.

**Honest note:** The course uses paid frontier models (OpenAI / Anthropic /
Gemini / DeepSeek / Groq) and a real Pushover account. This project instead runs
**entirely against a local [Ollama](https://ollama.com) server**, so it needs
**no paid API keys**. It uses the OpenAI SDK pointed at Ollama's
OpenAI-compatible endpoint. This proves the code runs end to end against a local
model; output quality is lower than the frontier models the course uses, and the
Pushover push is a print-only stub.

## Prerequisites

1. Ollama running at `http://localhost:11434`
2. The two models pulled:
   ```
   ollama pull llama3.2
   ollama pull dolphin3:8b
   ```
3. [uv](https://docs.astral.sh/uv/) installed.

## Setup

```
uv sync
cp .env.example .env      # optional; defaults already point at local Ollama
```

If `uv sync` fails on corporate TLS / certificate errors, retry with native TLS:

```
# PowerShell
$env:UV_NATIVE_TLS = "1"; uv sync
# bash
UV_NATIVE_TLS=1 uv sync
```

## How it talks to Ollama

```python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")  # key is ignored by Ollama
client.chat.completions.create(model="llama3.2", messages=[...], max_tokens=150)
```

## Run (one at a time - they share the single Ollama queue)

```
uv run python src/day1_workflow.py        # plan -> act 2-step workflow
uv run python src/day2_patterns.py        # chaining + routing patterns
uv run python src/day3_multi_llm.py       # llama3.2 vs dolphin3:8b, judged by llama3.2
uv run python src/day4_tools_structured.py# Pydantic structured output + a tool (with direct fallback)
uv run python src/career_agent.py         # the career "digital twin" + tool-call loop
```

## Files -> course parallel

| file | course lab |
|------|------------|
| `src/day1_workflow.py`        | `1_lab1.py` (first chained workflow) |
| `src/day2_patterns.py`        | `2_lab2.py` (workflow patterns) |
| `src/day3_multi_llm.py`       | `3_lab3.py` (multi-LLM + judge) |
| `src/day4_tools_structured.py`| `4_lab4.py` (tools + structured output) |
| `src/career_agent.py`         | `1_foundations__app.py` (career digital twin) |

Captured real outputs live in `out/`.
