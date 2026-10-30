# Week 5 (TypeScript) — AutoGen AgentChat **demo UI**

A small **React + Vite + TypeScript** demo UI that illustrates what an AutoGen
**AgentChat** exchange looks like: user → assistant messages, plus a **tool-call
badge** showing an `AssistantAgent` invoking the `get_city_price` Python-function
tool and getting a result back.

> **This is a demo UI, not AutoGen in TypeScript.** AutoGen is Python-primary
> (there is a .NET AutoGen but no first-class JS port). The content here is
> hard-coded/representative — no AutoGen package, no model, and no backend run
> behind this page. It mirrors the shape of the real Week 5 Python lab
> (`week5-py/src/lab1_agentchat.py`).

## Scripts

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run build       # tsc --noEmit && vite build  -> dist/
npm run preview     # serve dist/ (used for the screenshot)
npm run dev         # local dev server
```

## Stack

- React 19, Vite 8, TypeScript 5, `@vitejs/plugin-react`.
- Static SPA — no server, no network calls.
