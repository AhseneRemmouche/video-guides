# fasteat-agent-ts

The TypeScript version of the **LangChain Ultimate Crash Course 2026** companion project: a "personal chef" agent
that looks at a photo of your fridge, searches the web for a recipe that uses what it sees, and tells you how to cook
it. The Python original is the course repo `ACL_FastEat_Agent`; this folder ports its lessons and the chef project to
LangChain.js 1.x, with the bugs of the course already fixed, and adds a small React web app.

## Run it

1. Install [Node.js](https://nodejs.org) 22 or newer and [pnpm](https://pnpm.io/installation).
2. Pick your models. Copy `.env.example` to `.env`, then either:
   - **OpenAI** (like the course): put your key in `OPENAI_API_KEY`. The model is `gpt-5-nano`.
   - **Ollama** (free, on your computer): install [Ollama](https://ollama.com/download), run
     `ollama pull llama3.2` and `ollama pull gemma4`, and set `MODEL_PROVIDER=ollama`.
     llama3.2 answers text; gemma4 can also see photos.
3. Web search is optional: add a [Tavily](https://tavily.com) key in `TAVILY_API_KEY`. Without one the search tool
   answers "Web search is not configured (no TAVILY_API_KEY)" and the chef cooks from what it already knows.
4. In this folder: `pnpm install`, then run a lesson by its number, for example `pnpm lesson 04`.
5. The chef: `pnpm chef data/fridge.png` (any PNG, JPEG, WebP or GIF; without a path it asks for one).
6. The web app: `pnpm api` in one terminal, `pnpm web` in a second, then open http://localhost:5173.

| Folder | What is in it |
|---|---|
| `src/` | `models.ts` (OpenAI or Ollama, chosen by `MODEL_PROVIDER`) and a tiny logger |
| `lessons/` | One file per lesson, `04-models-agents.ts` to `11-multi-model-messages.ts` |
| `chef/` | The chef project: `main.ts`, `tools.ts`, `prompt.ts`, `photo-decoder.ts`, and the extensions `structured-chef.ts`, `chat-chef.ts`, `main-any-model.ts` |
| `server/` | A small Hono server that decodes the photo and streams the chef's answer to the browser |
| `web/` | The React + Vite app: photo upload (or drag and drop), streamed answer, follow-up chat, tool-call log |
| `tests/` | Offline tests (Vitest) with a pretend model: no key, no network |
| `data/` | `fridge.png`, a tiny drawn picture for trying things out |

## Commands

| Command | What it does |
|---|---|
| `pnpm lesson 08` | Runs `lessons/08-tools.ts` (`pnpm lesson 10-before` runs the version without memory) |
| `pnpm lesson 11 data/fridge.png` | The image lesson, with a photo |
| `pnpm chef data/fridge.png` | The chef (`chef/main.ts`) |
| `pnpm chef structured-chef data/fridge.png` | The chef's answer as a typed `Recipe` object |
| `pnpm chef chat-chef data/fridge.png` | Streams the answer, then lets you ask follow-up questions (q to quit) |
| `pnpm chef main-any-model data/fridge.png` | Any `provider:model` from `CHEF_MODEL`, e.g. `ollama:gemma4` |
| `pnpm test` | Offline tests |
| `pnpm typecheck` | Type check the Node code and the web app |
| `pnpm api` / `pnpm web` | The web app's API (port 8787) and the Vite dev server (port 5173) |
| `pnpm build:web` | Builds the web app into `web/dist` |

## Tests

`pnpm test` runs every lesson and chef file from top to bottom with a pretend model that answers from a script,
a canned search result instead of Tavily, and a pretend terminal. It checks the message flow (tool calls, memory with
and without a `thread_id`, streaming, structured output, image messages) and the fixes to the course's bugs. It does
not check what a real model would answer.

Model answers vary from run to run. Keys stay in `.env`, which git ignores.
