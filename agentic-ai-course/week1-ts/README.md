# Week 1 in TypeScript (Foundations, no framework)

A port of the Week 1 labs of *The Complete Agentic AI Engineering Course* (Ed Donner) to TypeScript, built for the
companion guide. Not part of the course. Uses the `openai` and `@anthropic-ai/sdk` packages directly, zod, unpdf,
Hono and React + Vite.

```
pnpm install
cp .env.example .env     # OPENAI_API_KEY, optional provider keys, PUSHOVER_USER / PUSHOVER_TOKEN
pnpm lab1                # Day 1: two calls, one feeding the other
pnpm lab2                # Day 3: one question, many models, an LLM judge
pnpm lab3                # Day 4: the career chatbot with an evaluator (pig-latin test)
pnpm lab4                # Day 5: tools with push notifications
pnpm build && pnpm api   # Day 5: the career chat app on http://localhost:8788
```

Put your own `me/linkedin.pdf` and `me/summary.txt` in `me/`, and set `ME_NAME=Your Name` in `.env`.
The `me/` files shipped here are the course author's public examples from the course repository.

Without an OpenAI key, run against a local Ollama model (every provider becomes that model):

```
OPENAI_BASE_URL=http://localhost:11434/v1 OPENAI_API_KEY=ollama MODEL=llama3.2 pnpm lab1
```
