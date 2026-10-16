# Week 4 in TypeScript (LangGraph for JavaScript)

A port of the Week 4 labs of *The Complete Agentic AI Engineering Course* (Ed Donner) to TypeScript, built for the
companion guide. Not part of the course. Uses `@langchain/langgraph`, `@langchain/openai`, zod, Playwright, Hono and
React + Vite.

```
pnpm install
pnpm exec playwright install chromium   # the browser the agent drives (Day 4 and 5)
cp .env.example .env     # add OPENAI_API_KEY (optionally SERPER_API_KEY, PUSHOVER_TOKEN/USER, LangSmith keys)
pnpm lab1                # Day 2: State + reducer, a graph without an LLM, then a chatbot graph (prints Mermaid)
pnpm lab2                # Day 3: tools, ToolNode + toolsCondition, MemorySaver with a thread_id, SqliteSaver (memory.db)
pnpm lab3                # Day 4: browser tools on Playwright, a chatbot that browses
pnpm lab4 ["request"] ["success criteria"]   # Day 4: worker/evaluator graph with structured output
pnpm sidekick ["request"] ["success criteria"]   # Day 5: one Sidekick super-step in the console
pnpm api                 # Day 5: Hono API on :8790 (serves web/dist after pnpm build)
pnpm web                 # Day 5: React dev server on :5173 (proxies /api)
pnpm build               # type-check + build the React app
```

Without an OpenAI key, run against a local Ollama model (search and push become clearly labelled stand-ins):

```
OPENAI_BASE_URL=http://localhost:11434/v1 OPENAI_API_KEY=ollama MODEL=llama3.2 pnpm lab1
```

Notes

- **Playwright.** The course uses Python's `PlayWrightBrowserToolkit`; LangChain JS has none, so `src/browserTools.ts`
  writes the same seven tools on the `playwright` npm package. Chromium opens a visible window like in the video; set
  `HEADLESS=true` to hide it. If `chromium.launch` says the executable doesn't exist, run
  `pnpm exec playwright install chromium` again (each Playwright version wants its own browser build).
- **Docker.** The Sidekick's `Python_REPL` tool runs code in a throw-away `python:3.12-slim` container (no network,
  256 MB) instead of on your machine like the course's `PythonREPLTool`. Start Docker Desktop first; the image is pulled
  on first use (`docker pull python:3.12-slim` to do it ahead of time). Without Docker the tool returns an error message
  to the model and everything else still works.
- **sandbox/.** The Sidekick's file tools can only read and write inside `sandbox/` next to where you start the
  program, so run the commands from this folder.
- **Windows + corporate proxy.** If `pnpm install` or `playwright install` fails with a certificate error, try
  `NODE_OPTIONS=--use-system-ca`.
