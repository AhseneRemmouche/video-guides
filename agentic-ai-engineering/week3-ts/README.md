# Week 3 — demo UI (React + TypeScript)

A small single-page UI that displays a **sample** `stock_picker` result: the
trending companies that were considered, the per-company research, and the final
pick with its rationale and decision report.

> **This is a demo UI, not CrewAI in TypeScript.** CrewAI is a Python-only
> framework — there is no JavaScript/TypeScript port. The actual multi-agent crew
> lives in `../week3-py`. This page only visualizes the *shape* of one
> representative result (see `src/data.ts`); the data is hard-coded and
> illustrative, and nothing here is investment advice.

The `types.ts` interfaces mirror the Pydantic models in the Python crew
(`TrendingCompany`, `TrendingCompanyResearch`, and the final decision output), so
the demo stays faithful to what the real crew produces.

## Stack

Vite + React 18 + TypeScript. No backend, no network calls.

## Scripts

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run build       # vite build -> dist/
npm run dev         # local dev server
npm run preview     # serve the production build
```

A screenshot of the built UI is at `../img/ts-week3-ui.png`.
