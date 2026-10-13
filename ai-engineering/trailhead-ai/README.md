# trailhead-ai

The lab project of the **AI Engineering hands-on companion**
(https://ahseneremmouche.github.io/video-guides/ai-engineering/).

A support bot for Trailhead Bikes, an invented online bike shop. Fourteen small labs build it step by step:
model calls, sampling, structured output, an eval set, an AI judge, retrieval, RAG, prompt versions, an agent,
guardrails, caching and routing, tracing and feedback, synthetic data and latency.

## Run it

1. Install [Ollama](https://ollama.com/download) and [uv](https://docs.astral.sh/uv/).
2. Pull the models:
   ```
   ollama pull llama3.2
   ollama pull gemma4
   ollama pull nomic-embed-text
   ```
3. In this folder: `uv sync`, then run a lab, for example `uv run python -m labs.01_hello`.
4. Offline tests (no model needed): `uv run pytest`.

Settings come from environment variables or a `.env` file; see `.env.example` (it also shows how to use OpenAI
instead of Ollama). Outputs of the labs go to `runs/`.

The shop, its documents and its orders are fictional. Model answers vary from run to run.
