# LLM Engineering - Week 8 (TypeScript + React)

A TypeScript + React **dashboard demo** for **Week 8** of Ed Donner's *LLM Engineering*
course - the capstone project, **"The Price is Right"**: an autonomous multi-agent
deal-hunting system.

In the course, a **Planning agent** coordinates:

- a **Scanner agent** that finds candidate deals from RSS feeds,
- an **Ensemble pricer agent** that estimates each item's fair price (a frontier model +
  a fine-tuned open-source model deployed on Modal + a RAG model), and
- a **Messaging agent** that pushes a notification when an item is priced well below the
  estimate.

That whole system (Modal-deployed models, RSS scanning, the agent framework) is **Python**.
**This repo is only the dashboard UI** that displays the deals, and it runs on
clearly-labelled **sample data** with **no external calls and no API key**.

## Layout

| Path | What it is |
| --- | --- |
| `src/deals.ts` | The `Deal` type, `sampleDeals()` (~6 labelled sample deals), and the pure `rankByDiscount(deals)` helper. `npm run deals` prints them ranked. |
| `server/index.ts` | Hono API: `GET /api/deals` returns the sample deals ranked by discount. A real build would return deals from the agent pipeline. No key needed. |
| `web/` | Vite + React 19 dashboard: cards of deals (price, estimate, discount %), with a "Scan for deals" button and the biggest discount highlighted. |

## Setup

```bash
npm install
# No .env needed to run the demo (see .env.example for context).
```

If npm 12 blocks the esbuild postinstall script, approve it once:

```bash
npm install-scripts approve esbuild
```

## Run

```bash
# CLI: print the sample deals ranked by discount
npm run deals

# Web UI (two terminals): the API, then the Vite dev server
npm run api     # Hono on http://localhost:8788
npm run web     # Vite on http://localhost:5173 (proxies /api -> 8788)
```

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run build       # typecheck + vite build
```

All data is sample data, so the demo compiles, builds, and runs without any API keys or
network access.
