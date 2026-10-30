# Week 5 - Fully Local RAG with Ollama

A minimal Retrieval-Augmented Generation (RAG) pipeline for **Week 5 of Ed Donner's
LLM Engineering course**, rebuilt to run **100% locally** with [Ollama](https://ollama.com) -
no OpenAI key, no cloud calls.

- **Chat model:** `llama3.2` (via `ChatOllama`)
- **Embeddings:** `nomic-embed-text` (via `OllamaEmbeddings`)
- **Vector store:** Chroma (persisted locally to `chroma_db/`)
- **Framework:** LangChain

The knowledge base is three tiny Markdown docs about a fictional insurtech company,
**Insurellm**, so there are real planted facts to retrieve (e.g. the CEO's name).

## Prerequisites

1. [Ollama](https://ollama.com) installed and running (`http://localhost:11434`).
2. The two models pulled:
   ```bash
   ollama pull llama3.2
   ollama pull nomic-embed-text
   ```
3. [uv](https://docs.astral.sh/uv/) installed.

## Setup

```bash
uv sync
cp .env.example .env   # optional - defaults already point at local Ollama
```

If `uv sync` fails on TLS/certificate verification, retry with native TLS:

```bash
UV_NATIVE_TLS=1 uv sync
```

## Run

```bash
# 1. Build the vector store from knowledge/*.md
uv run python src/ingest.py

# 2. Ask a question answered only by the docs
uv run python src/rag.py
# or pass your own:
uv run python src/rag.py "How much does Carllm cost?"
```

## Troubleshooting

- **`uv sync` certificate error** (`invalid peer certificate: UnknownIssuer`):
  retry with `UV_NATIVE_TLS=1 uv sync`.
- **`OPENSSL_Uplink ... no OPENSSL_Applink` crash on run**: some Python builds on
  Windows have an OpenSSL "applink" bug that crashes when a TLS client builds its
  default CA context - which httpx/ollama do eagerly at construction, even for
  plain `http://localhost`. `src/config.py` installs a small SSL shim that returns
  a bare (certless) `SSLContext` instead. This is safe here because every request
  is plain HTTP to local Ollama (no TLS handshake, so no CA bundle is needed).
  If your Python build is unaffected, the shim is harmless; you may remove
  `_install_ssl_shim()` from `config.py`.

## How it works

- `src/ingest.py` - loads `knowledge/*.md`, splits with
  `RecursiveCharacterTextSplitter`, embeds each chunk with
  `OllamaEmbeddings(nomic-embed-text)`, and persists them to a Chroma collection.
- `src/rag.py` - embeds the question, retrieves the top-k chunks from Chroma,
  stuffs them into a prompt, and asks `ChatOllama(llama3.2)` to answer using only
  that context. It prints the question, the retrieved sources, and the answer.
- `src/config.py` - shared settings (models, paths, chunking), configurable via `.env`.

## Files

```
week5-py/
  pyproject.toml      # uv project + deps
  .env.example        # local defaults (no secrets)
  knowledge/
    about.md          # company + CEO (Avery Lancaster)
    products.md       # 4 products + prices
    employees.md      # Maxine Thompson + IIOTY award
  src/
    config.py
    ingest.py
    rag.py
```
