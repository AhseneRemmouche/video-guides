# Week 2 in TypeScript (OpenAI Agents SDK for JavaScript)

A fresh TypeScript + React port of **Week 2** of Ed Donner's *Complete Agentic AI Engineering Course* -
the OpenAI Agents SDK and a deep-research multi-agent. Built for the companion guide; not part of the course.
Uses [`@openai/agents`](https://www.npmjs.com/package/@openai/agents) `0.20.0`, `zod`, `hono` and React + Vite.

## Run

```
npm install
cp .env.example .env     # add OPENAI_API_KEY (and optionally SENDGRID_API_KEY, EMAIL_FROM, EMAIL_TO, provider keys)

npm run day1             # Day 1: a first Agent + run(agent, input)
npm run day2             # Day 2: a function tool, agents-as-tools, and a handoff
npm run day3             # Day 3: structured output (zod outputType) + an input guardrail
npm run day4 "my query"  # Day 4: deep research in the console
npm run research "my query"  # the same deep-research pipeline, as a standalone CLI

npm run api              # Deep Research API on :8787 (serves web/dist after npm run build)
npm run web              # React dev server on :5173 (proxies /api to the API)

npm run typecheck        # tsc --noEmit
npm run build            # type-check + build the React app
```

## What's inside

| File | What it shows |
| --- | --- |
| `src/day1.ts` | `new Agent({ name, instructions, model })`, `run(agent, input)`, `withTrace(...)` |
| `src/day2.ts` | `tool({ name, description, parameters: z.object(), execute })`, `agent.asTool(...)`, `handoffs` |
| `src/day3.ts` | `outputType` with a zod schema, and an `InputGuardrail` with a tripwire |
| `src/research/planner.ts` | planner agent: structured `WebSearchPlan` output |
| `src/research/search.ts` | search agent with a **canned** function web-search tool (no hosted `WebSearchTool`) |
| `src/research/writer.ts` | writer agent: structured `ReportData` output |
| `src/research/email.ts` | email agent (stub): a function tool that prints the email unless SendGrid is set |
| `src/research/manager.ts` | `ResearchManager`: plan -> search (parallel) -> write -> email |
| `server/index.ts` | Hono `POST /api/research { query }`; returns a short report, `400` with no `OPENAI_API_KEY` |
| `web/` | Vite + React 19 deep-research UI |

## Notes

- **No hosted tools.** The course's search agent uses OpenAI's hosted `WebSearchTool`. This port uses a canned
  function tool instead, so it compiles and runs without OpenAI's hosted tools.
- **Email is a stub.** Without `SENDGRID_API_KEY` the email is printed to the console instead of sent, so every
  day runs end to end.
- **No key, no run.** The day scripts and the API need a model: a real `OPENAI_API_KEY`, or a local
  OpenAI-compatible server via `OPENAI_BASE_URL`. The API returns `400` when neither is set.

Local mode (no OpenAI key) against an Ollama model:

```
OPENAI_BASE_URL=http://localhost:11434/v1 OPENAI_API_KEY=ollama MODEL=llama3.2 npm run day1
```
