# Week 6 (TypeScript): portfolio demo UI

A small **React + Vite + TypeScript** demo UI for Week 6 (MCP). It renders a
**sample trading portfolio** — total value, cash, holdings table, and recent
trades — using static, representative demo data in `src/data.ts`.

It is clearly labelled a **demo**. It is **not** a port of the course's trading
floor and it is **not** connected to the Python accounts MCP server in
`../week6-py`; it only shows the *shape* of such an account so the Week 6 build
page has a UI screenshot.

## Run / verify

```bash
npm install
npm run typecheck   # tsc --noEmit, must be clean
npm run build       # tsc --noEmit + vite build, must be clean
npm run preview     # serve the built site (used for the screenshot)
```

## Files
- `index.html` — Vite entry.
- `src/main.tsx` — React root.
- `src/App.tsx` — the portfolio page (summary cards + two tables).
- `src/data.ts` — the static demo data (cash, holdings, recent trades).
- `src/styles.css` — light/dark-aware styling.
