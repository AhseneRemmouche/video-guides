# LLM Engineering - Week 3 (open-source HuggingFace, CPU edition)

A runnable Python project covering Week 3 of Ed Donner's *LLM Engineering*
course - the **open-source / HuggingFace** week. The course runs everything on a
Colab GPU; this project is adapted for a **CPU-only machine with no GPU**.

## What runs here, and what doesn't

| Day | Topic | On this CPU machine |
| --- | --- | --- |
| 2 | `pipeline(...)` high-level API | **Runs** - sentiment + summarization with small models |
| 3 | Tokenizers (`AutoTokenizer`) | **Runs** - encode/decode + chat template, ungated models |
| 4 | Model class + **4-bit quantization** | **Not run** - bitsandbytes 4-bit needs a CUDA GPU (note script) |
| 5 | **Whisper -> Llama** meeting minutes | **Not run** - step 2 is the Day 4 GPU setup (note script) |

The two "not run" days are provided as **note scripts** that print the exact
course code and explain precisely why they need a GPU. 4-bit `bitsandbytes`
quantization and the Whisper->Llama pipeline cannot run without CUDA.

## Requirements

- [uv](https://docs.astral.sh/uv/) (provisions Python 3.12 and the virtualenv)
- Network access to `huggingface.co` for the Day 2/3 model downloads. The demos
  use small, **ungated** models (no HF token needed).

## Setup

```sh
uv sync                 # creates .venv, installs transformers + CPU torch
cp .env.example .env    # optional; no key is needed for the CPU demos
```

`torch` (CPU build) is a large download. `pyproject.toml` pins the CPU wheel
index (`https://download.pytorch.org/whl/cpu`) so you don't pull the much larger
CUDA build. If `uv sync` fails on TLS certificates behind a corporate proxy,
retry with native TLS:

```sh
UV_NATIVE_TLS=1 uv sync
```

## Running the labs

```sh
# Day 2 - pipelines: sentiment-analysis + summarization (downloads small models)
uv run python src/pipelines_demo.py

# Day 3 - tokenizers: encode/decode + chat template (ungated gpt2 + Qwen2-0.5B)
uv run python src/tokenizers_demo.py

# Day 4 - NOTE ONLY: prints the 4-bit quantization code and why it needs a GPU
uv run python src/models_note.py

# Day 5 - NOTE ONLY: prints the Whisper->Llama minutes pipeline and why it needs a GPU
uv run python src/minutes_note.py
```

Captured stdout from a verification run lives in `out/`.

### Model downloads behind corporate TLS (this machine)

On first run each script downloads small models from `huggingface.co`. On the
machine this was verified on, live downloads through the `transformers`/
`huggingface_hub` **`requests`** path hard-crash the Python process with
`OPENSSL_Uplink ... no OPENSSL_Applink` (a native OpenSSL/applink mismatch - a
corporate-TLS style blob-download block, not a catchable Python error). Two
things that worked around it:

- Download the models once with a newer `huggingface_hub` (its httpx backend),
  e.g. `uv run --isolated --with "huggingface-hub>=2.0" --with hf-xet python -c
  "from huggingface_hub import snapshot_download; snapshot_download('sshleifer/distilbart-cnn-6-6')"`.
- Then run the demos **offline** so they load from the cache instead of making a
  revision-check network call:

  ```sh
  HF_HUB_OFFLINE=1 uv run python src/pipelines_demo.py
  HF_HUB_OFFLINE=1 uv run python src/tokenizers_demo.py
  ```

On a machine with unrestricted TLS the plain `uv run python src/...` commands
download and run with no extra steps.

### Notes

- **Day 2 / Day 3** download model files from the HuggingFace hub on first run.
  The summarizer (`sshleifer/distilbart-cnn-6-6`) is a few hundred MB; the
  tokenizer demos only pull small config/vocab files. Both scripts catch a
  download/TLS failure and report the exact error instead of crashing, so the
  API itself is still demonstrated even offline.
- The demos **force CPU** (`device=-1` for pipelines) and deliberately use small,
  **ungated** models (`gpt2`, `Qwen/Qwen2-0.5B-Instruct`,
  `sshleifer/distilbart-cnn-6-6`) - never gated Llama - so no HF token is needed.
- **Day 4 / Day 5** are the GPU labs. 4-bit `bitsandbytes` quantization only runs
  on an NVIDIA CUDA GPU, so they are not executed here; the note scripts show the
  real course code. Run those on a GPU runtime (e.g. Google Colab T4).
