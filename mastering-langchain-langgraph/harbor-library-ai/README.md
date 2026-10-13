# harbor-library-ai

The lab project of the **Mastering LangChain & LangGraph hands-on companion**
(https://ahseneremmouche.github.io/video-guides/mastering-langchain-langgraph/).

An assistant for Harbor City Library, an invented public library. Sixteen small labs build it with LangChain 1.x and
LangGraph 1.x: chat models, structured output, prompt templates, loaders, splitters, a vector store, retrievers,
LangGraph graphs, tools, an MCP server, checkpointers, memory, human-in-the-loop, `create_agent`, middleware and LCEL.

## Run it

1. Install [Ollama](https://ollama.com/download) and [uv](https://docs.astral.sh/uv/).
2. Pull the models:
   ```
   ollama pull llama3.2
   ollama pull nomic-embed-text
   ollama pull gemma4        # optional, only for the comparison in lab 14
   ```
3. In this folder: `uv sync`, then run a lab, for example `uv run python -m labs.01_chat_models`.
4. Offline tests (no model needed): `uv run pytest`.

Settings come from environment variables; see `.env.example`. Labs write files only to `runs/`.

The library, its policies, catalog and members are fictional. Model answers vary from run to run.
