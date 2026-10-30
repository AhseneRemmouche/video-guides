# LLM Engineering - Week 2 (TypeScript + React)

A TypeScript + React port of **Week 2** of Ed Donner's LLM Engineering course:
the *Multi-Modal Chatbot* - multiple APIs, tools / function-calling, and multimodal
image + audio. Gradio is replaced with a small React chat app, which is the whole point.

Model names are the video-era ones: `gpt-4o-mini`, `claude-3-5-sonnet-20240620`,
`claude-3-haiku-20240307`, `gemini-2.0-flash`, `dall-e-3`, `tts-1`.

## Setup

```bash
npm install          # node 24 / npm 12
cp .env.example .env # then add your OPENAI_API_KEY (Anthropic + Google keys optional)
```

If npm's script sandbox blocks esbuild's postinstall, run:

```bash
npm install-scripts approve esbuild
```

## The labs (run with tsx)

| Script          | File                      | What it shows |
|-----------------|---------------------------|---------------|
| `npm run day1`  | `src/day1_apis.ts`        | Call OpenAI, Claude (native `@anthropic-ai/sdk`) and Gemini (OpenAI-compatible base URL); a streaming helper; an adversarial GPT-vs-Claude conversation. |
| `npm run day3`  | `src/day3_chatbot.ts`     | A `chat(message, history)` function with a system prompt - the reusable chatbot core. |
| `npm run day4`  | `src/day4_tools.ts`       | OpenAI function-calling: a `get_ticket_price` tool (JSON schema) and the tool-call loop (model asks -> run function -> feed result back). |
| `npm run day5`  | `src/day5_multimodal.ts`  | `artist()` (DALL-E 3 `images.generate`) and `talker()` (`tts-1` `audio.speech`), plus a combined agent. Compiles and runs without a key. |

Day 4 prints its tool JSON schema and runs the tool offline; Day 5 reports the models
it *would* call. None of the labs call a provider unless the matching key is set.

## The chat app (React, replacing Gradio)

```bash
npm run api   # terminal 1: Hono API on http://localhost:8788
npm run web   # terminal 2: Vite dev server on http://localhost:5173 (proxies /api)
```

- `POST /api/chat`  - streams the Day 3 chatbot reply (message + history + optional system prompt)
- `POST /api/price` - runs the Day 4 tool-call loop and returns the final reply

With no `OPENAI_API_KEY` the routes return a clear `400` JSON error instead of crashing.

## Build

```bash
npm run typecheck   # tsc --noEmit
npm run build       # tsc --noEmit && vite build  -> web/dist
```

After `npm run build`, `npm run api` also serves the built app from `web/dist`.
