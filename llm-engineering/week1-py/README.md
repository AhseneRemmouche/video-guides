# LLM Engineering - Week 1 (local Ollama edition)

A runnable Python project covering the Week 1 labs of Ed Donner's *LLM
Engineering* course, adapted to run entirely against a **local Ollama** server.
No paid API keys, and the scraping labs use an offline HTML fixture so they
need **no network** at all.

## Requirements

- [uv](https://docs.astral.sh/uv/) (provisions Python 3.12 and the virtualenv)
- [Ollama](https://ollama.com) running locally with a chat model pulled:

  ```sh
  ollama pull llama3.2
  ```

  Ollama exposes an OpenAI-compatible endpoint at `http://localhost:11434/v1`,
  so the standard `openai` client works by just pointing `base_url` at it and
  passing a dummy `api_key="ollama"`.

## Setup

```sh
uv sync                 # creates .venv and installs deps
cp .env.example .env    # optional; defaults already point at local Ollama
```

If `uv sync` fails on TLS certificates behind a corporate proxy, retry with:

```sh
UV_NATIVE_TLS=1 uv sync
```

## Configuration (.env)

| Variable          | Default                        | Meaning                                  |
| ----------------- | ------------------------------ | ---------------------------------------- |
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1`    | Ollama's OpenAI-compatible endpoint      |
| `MODEL`           | `llama3.2`                     | Local chat model to use                  |

## Running the labs

Each script is standalone. Run from the project root:

```sh
# Day 1 - summarize a local webpage (offline fixture) via Ollama
uv run python src/day1_summarize.py

# Day 2 - the Chat Completions API two ways (raw HTTP + openai client)
uv run python src/day2_chat_api.py

# Day 4 - tokenization with tiktoken (needs the encoding cache)
TIKTOKEN_CACHE_DIR=/path/to/tcache uv run python src/day4_tokens.py

# Day 4 - the "illusion of memory" demo (forgets, then remembers)
uv run python src/day4_memory.py

# Day 5 - the brochure flow: pick links as JSON, then write a brochure
uv run python src/day5_brochure.py
```

### Notes

- **Day 1 / Day 5** parse `fixtures/sample.html` locally via `src/scraper.py`'s
  `load_local(path)` helper, so they never hit the network. The `Website` class
  can still scrape a live URL if you pass one.
- **Day 2** is the lab that genuinely uses a local model in the course. It shows
  the raw `requests.post` to `/v1/chat/completions` and the identical call
  through the `openai` library.
- **Day 4 tokens** uses OpenAI's `o200k_base` encoding offline. Set
  `TIKTOKEN_CACHE_DIR` to a folder holding the cached encoding so tiktoken does
  not try to download it. The sentence
  `"Hi my name is Ed and I like banoffee pie"` tokenizes to 11 tokens.
- Prompts and `max_tokens` are kept small so `llama3.2` responds quickly.
