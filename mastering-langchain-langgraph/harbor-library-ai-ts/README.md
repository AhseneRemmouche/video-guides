# harbor-library-ai-ts

The TypeScript version of the lab project of the **Mastering LangChain & LangGraph hands-on companion**
(https://ahseneremmouche.github.io/video-guides/mastering-langchain-langgraph/). The Python version is in
`../harbor-library-ai`.

An assistant for Harbor City Library, an invented public library. Sixteen small labs build it with LangChain.js 1.x
and LangGraph.js 1.x, and a React web app puts it in front of visitors: a chat with sources, a log of every tool
call, and an Approve / Reject card before any hold is placed.

## Run it

1. Install [Node.js](https://nodejs.org) 22 or newer, [pnpm](https://pnpm.io/installation) and
   [Ollama](https://ollama.com/download).
2. Pull the models:
   ```
   ollama pull llama3.2
   ollama pull nomic-embed-text
   ```
3. In this folder: `pnpm install`, then run a lab by its number, for example `pnpm lab 01`.
4. Offline tests (no model needed): `pnpm test`. Type check: `pnpm typecheck`.
5. The web app: `pnpm server` in one terminal, `pnpm web` in a second, then open http://localhost:5173.

| Folder | What is in it |
|---|---|
| `src/` | Shared code: model settings, catalog tools, policy loading and search, the agent graph, the MCP server |
| `labs/` | One file per lab, `01-chat-models.ts` to `16-lcel.ts` |
| `server/` | The agent and a small Hono server that streams its steps to the browser |
| `web/` | The React + Vite app |
| `tests/` | Offline tests (Vitest) |

Settings come from environment variables; see `.env.example`. Labs write files only to `runs/`.

The library, its policies, catalog and members are fictional. Model answers vary from run to run.
