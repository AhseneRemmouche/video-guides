# Week 4 (TypeScript) - LangGraph.js port

A TypeScript + React port of Week 4 of Ed Donner's Agentic AI course, built on
**LangGraph.js** (`@langchain/langgraph`). It mirrors the Python labs and the Sidekick app,
wired to a local **Ollama** model so it runs with no API key and no cost.

## Files

| File | What it shows |
| --- | --- |
| `src/model.ts` | Builds a `ChatOpenAI` pointed at Ollama. |
| `src/day1.ts` | A first tiny `StateGraph` (lab 1). |
| `src/day2.ts` | A chatbot graph (lab 2). |
| `src/day3.ts` | Tools + `toolsCondition` conditional edges + a `MemorySaver` checkpointer with a `thread_id` (lab 3). |
| `src/day4.ts` | The worker/evaluator loop with structured output via zod (lab 4). |
| `src/sidekick.ts` | The Sidekick graph builder, one per session. |
| `src/sidekick-tools.ts` | The tools module (calculator, web search, files, a JS runner, push - safe/keyless stubs). |
| `src/run.ts` | CLI entry that drives the Sidekick. |
| `server/index.ts` | A small Hono API (`POST /api/sidekick`). |
| `web/` | The React Sidekick chat UI (Vite). |

## Install

```bash
npm install
```

## Check it (no model needed)

```bash
npm run typecheck   # tsc --noEmit
npm run build       # tsc --noEmit && vite build
```

## Run it (needs Ollama)

```bash
ollama pull llama3.2
npm run day1        # or day2 / day3 / day4
npm run sidekick -- "your request" "your success criteria"

# Full app: API + React UI
npm run api         # http://localhost:8787
npm run web         # http://localhost:5173 (proxies /api to the API)
```

## Honesty

Web search (Serper), Wikipedia and push notifications are shown as safe stubs unless you
add the relevant keys; the Playwright browser tools from the course are not included.
The graph wiring (state, reducers, nodes, conditional edges, checkpointer memory,
worker/evaluator structured output) is the real thing.
