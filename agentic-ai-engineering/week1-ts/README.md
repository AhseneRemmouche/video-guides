# Agentic AI Engineering - Week 1 (Foundations), in TypeScript

A faithful TypeScript + React port of Week 1 of Ed Donner's Agentic AI
Engineering course. Week 1 is deliberately framework-free: plain LLM calls,
a hand-written tool-call loop, and a small chat UI. That ports cleanly to TS
using the official [`openai`](https://www.npmjs.com/package/openai) JS SDK.

The `uv`/Python stack of the original maps to Node + npm here.

## Setup

Requires Node 24 and npm 12.

```bash
npm install
cp .env.example .env     # then add your OPENAI_API_KEY
```

No key? Every script and the API route detect a missing key and exit cleanly
(or return a 400) instead of crashing. You can also point at a local Ollama
by setting `OPENAI_BASE_URL=http://localhost:11434/v1` and `OPENAI_API_KEY=ollama`.

## The labs (`src/`)

Each file is a self-contained port of one notebook. Run with `npm run <name>`.

| Script | Source lab | What it shows |
| ------ | ---------- | ------------- |
| `day1` | `1_lab1.py` | Your first call, then a 2-step **plan -> act** chain (propose a question, then answer it). Models: `gpt-4.1-nano`, `gpt-4.1-mini`. |
| `day2` | `2_lab2.py` | **Many LLMs through one client.** OpenAI, Claude, Gemini, DeepSeek and Groq all share the `openai` SDK - only `baseURL` + `apiKey` change. Then an **LLM judge** (`o3-mini`) ranks the answers. Providers without a key are skipped. |
| `day3` | `3_lab3.py` | The **evaluator-optimizer** pattern with **structured outputs** (zod schema): one model answers "as a person", a second (Gemini if available, else OpenAI) grades it, and we rerun on failure. |
| `day4` | `4_lab4.py` | **Tools and the tool-call loop** - two functions described as JSON schemas, run in a loop until the model is done. |
| `career` | `1_foundations__app.py` | The Week 1 **capstone**: a career "digital twin" that answers as a person, with `record_unknown_question` + `record_user_details` tools and a guarded Pushover push. Imported by the web API. |

> Note on numbering: days are mapped to the labs by file (`dayN` <- `N_labN.py`).
> The capstone career agent lives in `src/career.ts` and powers the web app.

## The web app (`web/` + `server/`)

A minimal React 19 "career chat": ask the digital twin a question and it replies
as the person, using the same tool-call loop as `src/career.ts`.

```bash
npm run build     # typecheck + vite build -> web/dist
npm run api       # Hono API on :8788, also serves web/dist
# or, for live dev with the Vite proxy:
npm run web       # Vite dev server on :5173, proxies /api -> :8788
npm run api       # (in a second terminal)
```

- `POST /api/career {message, history}` -> `{reply}`
- Returns `400 {error}` when `OPENAI_API_KEY` is not set on the server.

## Scripts

| Script | Does |
| ------ | ---- |
| `npm run day1..day4` | run a lab (`tsx`) |
| `npm run career` | career-agent CLI demo |
| `npm run api` | Hono API + static web (`tsx server/index.ts`) |
| `npm run web` | Vite dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | typecheck + `vite build` |

If npm's script-approval blocks esbuild's postinstall, run
`npm install-scripts approve esbuild` and reinstall.
