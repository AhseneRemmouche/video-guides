# Week 5 in TypeScript (AutoGen ideas on the OpenAI Agents SDK for JavaScript)

A port of the Week 5 labs of *The Complete Agentic AI Engineering Course* (Ed Donner) to TypeScript, built for the
companion guide. Not part of the course. Microsoft AutoGen has no JavaScript version, so: the AgentChat labs use
`@openai/agents` 0.20.0 and zod; AutoGen Core is replaced by a small teaching runtime (`src/core/runtime.ts`); the gRPC
distributed runtime is replaced by an HTTP stand-in built with Hono (`src/core/distributed.ts`). Needs Node 22.5+
(`node:sqlite`) and, for the MCP step, `uvx`.

```
pnpm install
cp .env.example .env     # add OPENAI_API_KEY (and optionally SERPER_API_KEY)
pnpm lab1                # Day 1: model, message, agent, SQLite ticket-price tool
pnpm lab2                # Day 2: image input, structured output, search + file tools, primary/evaluator team, MCP fetch
pnpm lab2 team           #        or one step: image | structured | tools | team | mcp
pnpm lab3                # Day 3: Core-style runtime: echo agent, LLM delegate, rock-paper-scissors (Player 2 on Ollama)
pnpm lab4                # Day 4: host + three workers (two child processes); ALL_IN_ONE_WORKER=true for one worker
pnpm world               # Day 5: the Agent Creator writes and runs src/agentN.ts files (HOW_MANY_AGENTS, default 3)
pnpm typecheck
```

`pnpm world` runs code written by an LLM on your machine, with no guardrails. Read `src/creator.ts` first.

Without an OpenAI key, run against a local Ollama model (web search becomes a canned stand-in):

```
OPENAI_BASE_URL=http://localhost:11434/v1 OPENAI_API_KEY=ollama MODEL=llama3.2 pnpm lab1
```
