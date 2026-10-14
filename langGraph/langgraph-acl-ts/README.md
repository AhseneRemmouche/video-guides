# langgraph-acl-ts

The TypeScript version of the course project from the **Ultimate LangGraph Crash Course 2026** (AI Career Lab).
The Python original is https://github.com/Mohamad-Hachem/LangGraph_ACL.

Every course graph (`module1/0` to `9`, there is no 7) is here as a LangGraph.js 1.x file with the same number,
plus three extensions (a division tool, memory in SQLite, streaming and drawing), the variants shown in the video
(`lessons/`), offline tests, and a small React web app: a chat with the graph-9 agent that shows each graph step as
it happens and remembers each thread.

Where the Python course file has a bug, the TypeScript file is the fixed version (graph 3 reads the model's
number safely, graphs 8 and 9 put the system message first, graph 9 runs its demo only when started directly).

## Run it

1. Install [Node.js](https://nodejs.org) 22 or newer and [pnpm](https://pnpm.io/installation).
2. Pick a model. Either an OpenAI key, or [Ollama](https://ollama.com/download) for a free local model:
   copy `.env.example` to `.env`, then set `OPENAI_API_KEY`, or set `MODEL_PROVIDER=ollama` and run
   `ollama pull llama3.2`.
3. In this folder: `pnpm install`, then run a graph by its number: `pnpm graph 0` (graphs 0, 1 and 2 need no model).
4. A lesson variant: `pnpm lesson 0-graph-state-str-mistake` (run `pnpm lesson` alone to see the list).
5. The LangSmith quickstart from the setup chapter: `pnpm main`.
6. Offline tests (no key, no model): `pnpm test`. Type check: `pnpm typecheck`.
7. The web app: `pnpm api` in one terminal (not `pnpm server`: that is a built-in pnpm command), `pnpm web` in a second, then open http://localhost:5173.

| Folder | What is in it |
|---|---|
| `src/` | `model.ts` (the one place that picks OpenAI or Ollama), `is-main.ts`, `show.ts` |
| `module1/` | One file per graph, `0-graph-state-str.ts` to `12-graph-stream-and-draw.ts` |
| `lessons/` | The variants from the video: the two mistakes, MessagesState written by hand, the tool node by hand |
| `scripts/` | `run.ts`, used by `pnpm graph` and `pnpm lesson` |
| `server/` | A small Hono server that streams the graph's steps to the browser |
| `web/` | The React + Vite app |
| `tests/` | Offline tests (Vitest) with a fake chat model |

`langgraph.json` registers the graphs for the LangGraph.js dev server and LangGraph Studio:
`npx @langchain/langgraph-cli dev` (needs a LangSmith account to open Studio). Graphs 9 and 11 are not registered:
they bring their own checkpointer, and the server provides its own memory.

`pnpm graph 11` writes `checkpoints.sqlite` in this folder. Model answers vary from run to run.
