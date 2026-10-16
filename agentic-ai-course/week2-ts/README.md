# Week 2 in TypeScript (OpenAI Agents SDK for JavaScript)

A port of the Week 2 labs of *The Complete Agentic AI Engineering Course* (Ed Donner) to TypeScript, built for the
companion guide. Not part of the course. Uses `@openai/agents` 0.20.0, zod, Hono and React + Vite.

```
pnpm install
cp .env.example .env     # add OPENAI_API_KEY (and optionally SENDGRID_API_KEY, EMAIL_FROM, EMAIL_TO, provider keys)
pnpm lab1                # Day 1: one agent, one trace
pnpm lab2                # Day 2: workflow, tools, agents as tools, handoff
pnpm lab3                # Day 3: other providers, structured output, input guardrail
pnpm lab4 "your query"   # Day 4: deep research in the console
pnpm api                 # Day 5: Hono API on :8787 (serves web/dist after pnpm build)
pnpm web                 # Day 5: React dev server on :5173 (proxies /api)
pnpm build               # type-check + build the React app
```

Without an OpenAI key, run against a local Ollama model (web search becomes a canned stand-in):

```
OPENAI_BASE_URL=http://localhost:11434/v1 OPENAI_API_KEY=ollama MODEL=llama3.2 pnpm lab1
```
