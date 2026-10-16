# Week 3 in TypeScript (CrewAI-style crews on the OpenAI Agents SDK)

A companion port of the Week 3 projects of *The Complete Agentic AI Engineering Course* (Ed Donner), built for the
guide. Not part of the course. CrewAI exists only for Python, so `src/minicrew.ts` is a small crew runner on
`@openai/agents` 0.20.0 that reads the course's own `agents.yaml` and `tasks.yaml` (copied unchanged into `crews/`),
builds prompts with CrewAI's wording, and runs tasks in sequence or through a manager agent.

```
pnpm install
cp .env.example .env          # add OPENAI_API_KEY (and optionally SERPER_API_KEY, PUSHOVER_*, provider keys)
pnpm debate                   # Day 1: proposer, opposer, judge
pnpm financial                # Day 2: researcher with web search + analyst
pnpm stocks "Technology"      # Days 3-4: structured outputs, push tool, manager, JSON-file memory
pnpm coder                    # Day 4: an agent that runs its Python in Docker
pnpm engineering              # Day 5: lead, backend, frontend and test engineers
pnpm build && pnpm api        # React crew runner on http://localhost:8789
pnpm web                      # or: React dev server (proxies /api to :8789)
```

Docker Desktop must be running for `coder` and `engineering` (code runs in `python:3.12-slim`, no network).
Outputs go to `output/<crew>/`; the stock picker's memory to `memory/stock_picker.json` (delete it to forget).

Without an OpenAI key, run every agent on a local Ollama model (search becomes a canned stand-in):

```
OPENAI_BASE_URL=http://localhost:11434/v1 OPENAI_API_KEY=ollama MODEL=llama3.2 pnpm debate
```

Not ported: CrewAI's vector/SQLite memory (replaced by a JSON file), knowledge sources, planning, and its
ReAct "Thought / Final Answer" text format (the Agents SDK uses native tool calling).
