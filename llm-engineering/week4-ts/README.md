# LLM Engineering - Week 4 (TypeScript + React)

A TypeScript + React port of **Week 4** of Ed Donner's *LLM Engineering* course: the
code-generation project. Send slow Python to a frontier model and get back a
high-performance **C++** rewrite, streamed into a two-pane UI.

- **GPT-4o** via the `openai` client library
- **Claude 3.5 Sonnet** (`claude-3-5-sonnet-20240620`) via the native `@anthropic-ai/sdk`

The course also demonstrates open-source code models (CodeQwen, etc. via HuggingFace /
Ollama / OpenRouter) and an evaluation discussion (model-centric vs business-centric
metrics). This port focuses on the reusable core - the model-driven Python-to-C++ port and
the UI around it. Because open-source endpoints are OpenAI-compatible, adding one is just a
new `baseURL` + `apiKey`, exactly as in Week 1/2.

## Layout

| Path | What it is |
| --- | --- |
| `src/optimize.ts` | `optimizePython(python, model)` - streams a C++ port from GPT-4o or Claude. Key-guarded. |
| `server/index.ts` | Hono API: `POST /api/optimize {python, model}` streams the C++; 400 JSON if the needed key is missing. |
| `web/` | Vite + React 19 two-pane UI (Python left, C++ right, model dropdown, Optimize button). |

## Setup

```bash
npm install
cp .env.example .env   # add the key(s) for the model(s) you want
```

You only need the key for the model you pick:
`OPENAI_API_KEY` for GPT-4o, `ANTHROPIC_API_KEY` for Claude.

## Run

```bash
# CLI: optimise the built-in sample Python (defaults to gpt-4o)
npm run optimize -- gpt-4o
npm run optimize -- claude

# Web UI (two terminals): the API, then the Vite dev server
npm run api     # Hono on http://localhost:8788
npm run web     # Vite on http://localhost:5173 (proxies /api -> 8788)
```

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run build       # typecheck + vite build
```

Everything is key-guarded, so it compiles and builds without any API keys; calls only
happen once you supply a key and click Optimize.
