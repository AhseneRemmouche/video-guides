# Week 6 — Product Pricer: ML Baselines + Model Eval (offline, synthetic)

A small, **runnable** version of Week 6 of Ed Donner's *LLM Engineering* course
(the "product pricer"). The course predicts a product's price from its text
description, builds traditional ML baselines, compares frontier LLMs, and ends
by fine-tuning a frontier model.

## What is real here vs. what the course does

This project is **honest about its scope**:

- **Synthetic data, not the course's dataset.** The course uses a large Amazon
  products dataset from Hugging Face (`ed-donner/items_full`). That is too big
  to reproduce offline, so `make_data.py` generates ~300 synthetic product
  "descriptions" whose price is a noisy function of category, brand and size.
- **Local LLM, not frontier models.** The course calls GPT / Claude / Gemini.
  Here `frontier_eval.py` points an OpenAI-compatible client at a **local Ollama**
  server running `llama3.2:latest`. A small local model is modest — this step
  verifies the eval *pipeline*, it is not a fair model comparison.
- **The sklearn baselines are genuinely trained and scored** on real (synthetic)
  held-out data. Those numbers are real.
- **Fine-tuning is not run.** `finetune_note.py` explains the paid OpenAI
  fine-tuning + W&B finale and shows the JSONL row shape, without executing it.

## Setup

```bash
uv sync
# If uv sync fails with a TLS/certificate error:
#   UV_NATIVE_TLS=1 uv sync
```

The LLM step talks to Ollama as an OpenAI-compatible endpoint:

```python
OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")
```

Defaults are baked in; copy `.env.example` to `.env` only to override them.
Make sure Ollama is running and the model is pulled:

```bash
ollama pull llama3.2:latest
```

## Run (in order)

```bash
uv run python src/make_data.py        # generate data/train.csv + data/test.csv
uv run python src/baselines.py        # train + score the ML baselines
uv run python src/frontier_eval.py    # local-LLM price estimates vs baselines
uv run python src/finetune_note.py    # explains the (not-run) fine-tuning finale
```

## Files

- `src/make_data.py` — synthetic dataset generator (train/test split).
- `src/baselines.py` — constant/mean, CountVectorizer+LinearRegression, RandomForest.
- `src/frontier_eval.py` — local Ollama price estimation + Average Absolute Error.
- `src/finetune_note.py` — note on the real fine-tuning finale + JSONL shape.
- `data/` — generated CSVs (created by the scripts).

## Metric

**Average Absolute Error** = mean of `|predicted - actual|` in dollars, lower is
better. This matches the spirit of the course's error metric.
