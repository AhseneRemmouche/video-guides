# Week 5 (Python) — Microsoft AutoGen against local Ollama

Runnable adaptations of Week 5 of Ed Donner's Agentic AI Engineering course,
covering **Microsoft AutoGen**. Everything here runs against a **local Ollama**
model (`llama3.2`) — free, no API key, no paid endpoints.

## What AutoGen is

AutoGen has two layers used here:

- **AgentChat** (`autogen-agentchat`) — the high-level conversational API:
  `AssistantAgent`, `TextMessage`, `on_messages(...)`, tools.
- **Core** (`autogen-core`) — the low-level message-passing runtime:
  `@dataclass` messages, `RoutedAgent`, `@message_handler`, `AgentId`, and
  `SingleThreadedAgentRuntime`.

The course's OpenAI client is swapped for AutoGen's native Ollama client:

```python
from autogen_ext.models.ollama import OllamaChatCompletionClient
model_client = OllamaChatCompletionClient(model="llama3.2")
```

## Files

| File | What it shows |
| --- | --- |
| `src/lab1_agentchat.py` | AgentChat basics: a plain `AssistantAgent`, then one given a Python-function **tool** (`get_city_price`) backed by a tiny SQLite DB. |
| `src/lab3_core.py` | AutoGen **Core**: a trivial `RoutedAgent`, then rock-paper-scissors where a referee agent messages two player agents over a `SingleThreadedAgentRuntime` and an LLM judges. |

## Prerequisites

- [uv](https://docs.astral.sh/uv/) (tested with 0.11.7)
- [Ollama](https://ollama.com/) running at `http://localhost:11434` with the
  model pulled: `ollama pull llama3.2`

## Setup & run

On this machine `uv sync` must run with `UV_NATIVE_TLS=1` (otherwise TLS
`UnknownIssuer`):

```bash
UV_NATIVE_TLS=1 uv sync

uv run python src/lab1_agentchat.py
uv run python src/lab3_core.py
```

Real captured output and honest caveats are in [`RUN-NOTES.md`](./RUN-NOTES.md).

## Honesty / scope

- **What runs here:** the AgentChat conversational examples (lab 1) and a Core
  message-passing example (lab 3), against local Ollama.
- **What is NOT run here:** the course's **distributed gRPC runtime** (lab 4,
  `GrpcWorkerAgentRuntime` + `GrpcWorkerAgentRuntimeHost`) and the agent-writing
  **"world" capstone** (lab 5). Those need extra infra (a running gRPC host and
  multiple worker processes) and are shown as in the course, not run here. See
  `code/w5/4_lab4_autogen_distributed.py` and `code/w5/5_autogen__*.py` for the
  original course code.
- **Small-model caveat:** `llama3.2` (3.2B) calls tools inconsistently and
  doesn't always obey "one word only" instructions. The scripts print what the
  model actually did; `RUN-NOTES.md` records it honestly.
- **No paid APIs** are used anywhere in this project.
