# Week 8 - Autonomous Deal-Hunting Agent (local Ollama verification)

A runnable slice of Week 8 from Ed Donner's LLM Engineering course: the
autonomous deal-hunting agent pipeline **scan -> price -> rank -> alert**.

The full course system needs infrastructure that is not available here, so
those pieces are **stubbed**:

| Real system | Here |
|---|---|
| Specialist pricer fine-tuned LLM deployed on **Modal** (ensemble) | one short call to **local Ollama** (`llama3.2:latest`) |
| **ScannerAgent** reading live **RSS** deal feeds | small hard-coded sample list in `src/deals.py` |
| Messaging agent sending **Pushover** push | `messaging_agent_alert()` just **prints** |

Only the agent LOGIC is verified. Local small-model price estimates are
rough by design — the point is that the pipeline runs end to end.

## Requirements

- [uv](https://docs.astral.sh/uv/)
- [Ollama](https://ollama.com/) running at `http://localhost:11434` with the
  model pulled: `ollama pull llama3.2:latest`

The model is reached through the OpenAI-compatible endpoint:
`OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")`.

## Setup & run

```bash
uv sync                 # if TLS errors: UV_NATIVE_TLS=1 uv sync
cp .env.example .env     # optional; code defaults already match Ollama

uv run python src/planning_agent.py   # scan -> price (6 Ollama calls) -> rank -> alert
uv run python src/modal_note.py        # what Modal/RSS/Pushover would do
uv run python src/pricer_agent.py      # single pricer demo call
```

`src/planning_agent.py` makes ~6 short model calls (one per sample deal), so
give it a moment.

## Files

- `src/deals.py` - sample "scanned" deals (stands in for the RSS scanner)
- `src/pricer_agent.py` - `estimate_price(description)` via local Ollama
- `src/planning_agent.py` - the planning loop + print-only messaging stub
- `src/modal_note.py` - note on the Modal / RSS / Pushover pieces not run here

## Config (`.env`, optional)

```
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_API_KEY=ollama
OLLAMA_MODEL=llama3.2:latest
```
