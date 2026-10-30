# Week 4 (Python) - RUN NOTES

Honest record of what was actually run on this machine, what was skipped, and why.

## Environment

- Windows 11, uv 0.11.7, CPython 3.12.12 (uv-managed, python-build-standalone).
- Local **Ollama** at `http://localhost:11434/v1`, model **`llama3.2:latest`**.
- No GPU, no C/C++ compiler, no paid API keys.
- Key packages: `langgraph 1.2.18`, `langchain-openai 1.7.3`, `langchain-community`,
  `langgraph-checkpoint-sqlite`, `pydantic`, `python-dotenv`.

## Install

```bash
cd week4-py
UV_NATIVE_TLS=1 uv sync
```

`uv sync` succeeded with `UV_NATIVE_TLS=1` (without it, uv fails with a TLS "UnknownIssuer"
error on this machine). Playwright is an **optional** extra (`--extra browser`) and was **not**
installed - the runnable core needs no browser.

### Two environment fixes that were needed (documented for honesty)

1. **`SSLKEYLOGFILE` / "no OPENSSL_Applink" crash.** This machine has a global
   `SSLKEYLOGFILE` env var pointing at a network-filter driver path
   (`\\.\nllMonFltProxy\...`). `langchain_openai` calls `ssl.create_default_context()`
   at import, which tries to open that path through OpenSSL; uv's standalone CPython
   then hard-aborts with `OPENSSL_Uplink(...): no OPENSSL_Applink`. Since these examples
   only talk to a local Ollama server over plain HTTP, `src/common.py` drops that env var
   at import time (`os.environ.pop("SSLKEYLOGFILE", None)`). This is the single line that
   makes `import langchain_openai` work here.
2. **Graph diagrams.** The course renders the graph with `draw_mermaid_png()` (needs a
   network call to mermaid.ink) / `draw_ascii()` (needs the `grandalf` package). To keep
   the core dependency-light and offline, the scripts print `draw_mermaid()` **text**
   instead (no extra dependency, no network). The Mermaid text is shown below.

## Lab 2 - chatbot StateGraph  (RAN ✅, against Ollama)

```
UV_NATIVE_TLS=1 uv run python src/lab2_chatbot.py
```

Real output (graph is START -> chatbot -> END):

```
graph TD;
	__start__([__start__]):::first
	chatbot(chatbot)
	__end__([__end__]):::last
	__start__ --> chatbot;
	chatbot --> __end__;

User: In one sentence, what is LangGraph?
Assistant: I couldn't find any information on "LangGraph". ... Can you provide more context ...
User: Name one benefit of modelling an agent as a graph. One sentence.
Assistant: Modelling an agent as a graph allows for the representation of complex relationships
and interactions between the agent's components ... in a structured and easily manageable way.
```

(llama3.2 does not know the term "LangGraph" - that is the model's own answer, not an error.
The point of the lab is that the StateGraph compiled, invoked, and routed through the single
`chatbot` node.)

## Lab 3 - tools + conditional edges + memory  (RAN ✅, against Ollama, memory proven)

```
UV_NATIVE_TLS=1 uv run python src/lab3_tools_memory.py
```

Real output (graph loops chatbot <-> tools; `chatbot -.-> __end__` and `-.-> tools` are the
`tools_condition` conditional edges):

```
[checkpointer] MemorySaver (in-process)
graph TD;
	__start__ --> chatbot;
	chatbot -.-> __end__;
	chatbot -.-> tools;
	tools --> chatbot;

[thread=demo-thread-1] User: My name is Ada. Please use the calculator to compute 23 * 19.
Assistant: The result of 23 multiplied by 19 is 437, Ada!

[thread=demo-thread-1] User: What is my name, and what was the multiplication result you gave me?
Assistant: ... Your name is Ada, and the result of 23 multiplied by 19 is 437.

[thread=demo-thread-2] User: What is my name?
Assistant: It seems I don't have any information on your name. ...

[checkpoint] thread 'demo-thread-1' holds 8 messages.
```

What this proves:
- **Tool use**: the `calculator` tool was actually called and returned `437` (the model only
  gets that number by routing through the `tools` node via `tools_condition`).
- **Memory across turns (same `thread_id`)**: turn 2 sends ONLY the new question, yet the
  assistant recalls "Ada" and "437" from turn 1 - because the `MemorySaver` checkpointer
  restored the thread's 8 stored messages. This is the core point of the lab.
- **Thread isolation**: a different `thread_id` ("demo-thread-2") has no memory of Ada.

### SQLite checkpointer variant (RAN ✅)

```
CHECKPOINTER=sqlite UV_NATIVE_TLS=1 uv run python src/lab3_tools_memory.py
```

Same behaviour, but state is written to a `memory.db` SQLite file via `SqliteSaver`
(so memory would survive a process restart). Confirmed: `[checkpointer] SqliteSaver -> memory.db`,
`memory.db` (~76 KB) was created, and the same "Ada / 437" recall happened. The generated
`memory.db` was deleted afterwards to keep the project clean.

## Slimmed Sidekick - worker/evaluator loop  (RAN ✅, against Ollama)

```
UV_NATIVE_TLS=1 uv run python src/sidekick.py
```

Real output (graph: worker -> tools/evaluator, evaluator -> worker/END):

```
graph TD;
	__start__ --> worker;
	worker -.-> tools;
	worker -.-> evaluator;
	tools --> worker;
	evaluator -.-> worker;
	evaluator -. END .-> __end__;

Worker answer : The tip amount for a 15% tip on a $120 bill is $18.00.
Evaluator      : Evaluator Feedback: The Assistant's response meets the success criteria. ...
Criteria met   : True
Input needed   : False
```

What this proves: the worker used a tool, produced an answer, the **structured-output**
evaluator (`EvaluatorOutput` Pydantic model via `with_structured_output`) judged it against
the success criteria and returned `success_criteria_met=True`, so the conditional edge routed
to `END`. Same graph shape as the course's Sidekick.

## What was NOT run (shown in the guide as in the course, not executed here)

- **Playwright browser tools** (`PlayWrightBrowserToolkit`, `create_async_playwright_browser`):
  need a real Chromium download and a browser session. The slimmed `sidekick.py` swaps them for
  two safe local tools (a `calculator` and a sandboxed `run_python`); the Playwright wiring is
  kept in a commented block so you can see exactly where it would go.
- **Serper web search** (`GoogleSerperAPIWrapper`): needs a `SERPER_API_KEY` and makes live web
  calls. Replaced by local tools.
- **Pushover push notifications** (`send_push_notification`): needs `PUSHOVER_TOKEN` / `PUSHOVER_USER`
  and posts to `api.pushover.net`. Not included in the runnable core.
- **Paid OpenAI models** (`gpt-4o-mini`) and **LangSmith tracing**: the course uses them; here
  everything runs against local Ollama with `llama3.2`, so there is no cost and no API key.

These external pieces are described and shown as code in the guide pages exactly as the course
presents them; the graph wiring itself (state, reducers, nodes, conditional edges, checkpointing
memory, worker/evaluator structured output) is what is verified locally above.
