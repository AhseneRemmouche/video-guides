# Week 1 in TypeScript - LLM Engineering (Ed Donner)

A TypeScript + React port of Week 1 of Ed Donner's *LLM Engineering* course, built for the companion guide.
It uses the `openai` JS SDK directly, `node-html-parser` for scraping, `gpt-tokenizer` for tokens, and
Hono + React + Vite for the web app. Model names match the video era (gpt-4o-mini, gemini-2.0-flash, llama3.2).

## Setup

```
npm install
cp .env.example .env     # then put your OPENAI_API_KEY in .env
```

## The labs (run with tsx)

```
npm run day1          # Day 1: website summarizer (give it a URL)
npm run day2          # Day 2: the Chat Completions API three ways (raw HTTP, SDK, compatible endpoints)
npm run day4-tokens   # Day 4: tokenize text with gpt-tokenizer (o200k_base) - runs offline, no key
npm run day4-memory   # Day 4: the illusion of memory (stateless replay)
npm run day5          # Day 5: pick relevant links as JSON, then stream a company brochure
```

`npm run day1 -- https://example.com` and `npm run day5 -- "Company" https://example.com` take arguments.
Only `day4-tokens` runs without a network connection and an API key.

## The web app

```
npm run build         # type-check, then build the React app into web/dist
npm run api           # start the Hono API on http://localhost:8788 (serves web/dist too)
npm run web           # (alternative) Vite dev server on http://localhost:5173, proxying /api
```

Open the page, enter a URL (and a company name), and click **Summarize** (Day 1) or **Make brochure** (Day 5).
Without `OPENAI_API_KEY` set, the API routes return a clear 400 JSON error instead of crashing.

## Scripts

- `npm run typecheck` - `tsc --noEmit`
- `npm run build` - `tsc --noEmit` then `vite build`
