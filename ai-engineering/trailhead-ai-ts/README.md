# trailhead-ai-ts

The TypeScript version of the lab project of the **AI Engineering hands-on companion**
(https://ahseneremmouche.github.io/video-guides/ai-engineering/). The Python version is in `../trailhead-ai`.

A support bot for Trailhead Bikes, an invented online bike shop. Fourteen small labs build it step by step:
model calls, sampling, structured output, an eval set, an AI judge, retrieval, RAG, prompt versions, an agent,
guardrails, caching and routing, tracing and feedback, synthetic data and latency. A React web app puts the bot in
front of customers: a streaming chat with cited sources, guardrail flags and thumbs up / down that land in the same
trace database as lab 12.

## Run it

1. Install [Node.js](https://nodejs.org) 22.13 or newer (the trace log uses the built-in `node:sqlite`),
   [pnpm](https://pnpm.io/installation) and [Ollama](https://ollama.com/download).
2. Pull the models:
   ```
   ollama pull llama3.2
   ollama pull gemma4
   ollama pull nomic-embed-text
   ```
3. In this folder: `pnpm install`, then run a lab by its number, for example `pnpm lab 01`.
4. Offline tests (no model needed): `pnpm test`. Type check: `pnpm typecheck`.
5. The web app: `pnpm api` in one terminal, `pnpm web` in a second, then open http://localhost:5173.

| Folder | What is in it |
|---|---|
| `src/` | Shared code: the model wrapper, chunking, retrievers, RAG, judge, guardrails, caches, router, agent, tracing |
| `labs/` | One file per lab, `01-hello.ts` to `14-latency.ts` |
| `server/` | A small Hono server that runs the guarded RAG bot and streams its answer to the browser |
| `web/` | The React + Vite app |
| `tests/` | Offline tests (Vitest) |
| `data/`, `evals/`, `prompts/` | The shop's documents and orders, the eval sets, the prompt versions |

Settings come from environment variables or a `.env` file; see `.env.example` (it also shows how to use OpenAI
instead of Ollama). Labs write their outputs to `runs/`; lab 12 also writes `evals/from_feedback.jsonl`.

The shop, its documents and its orders are fictional. Model answers vary from run to run.
