"""Shared setup: build a ChatOpenAI pointed at the local Ollama server.

The course uses OpenAI's hosted gpt-4o-mini. To run everything locally with no API
key and no cost, we point LangChain's ChatOpenAI at Ollama's OpenAI-compatible
endpoint (http://localhost:11434/v1). The model name and base URL can be overridden
with env vars so the same code can talk to real OpenAI if you ever want to.
"""

import os

# --- Windows / uv environment fix (must run before importing langchain_openai) ---
# This machine has a global SSLKEYLOGFILE pointing at a network-filter driver path.
# langchain_openai calls ssl.create_default_context() at import, which tries to open
# that path through OpenSSL; uv's standalone CPython then aborts with
# "no OPENSSL_Applink". We only talk to a local Ollama server over plain HTTP, so TLS
# key logging is irrelevant here - drop the variable so the import succeeds.
os.environ.pop("SSLKEYLOGFILE", None)

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

# Load a .env if present (override=True mirrors the course's habit).
load_dotenv(override=True)

# Where the model lives. Defaults to the local Ollama server.
OLLAMA_BASE_URL = os.getenv("OPENAI_BASE_URL", "http://localhost:11434/v1")
MODEL = os.getenv("MODEL", "llama3.2")
API_KEY = os.getenv("OPENAI_API_KEY", "ollama")  # Ollama ignores the value, but one is required.


def make_llm(temperature: float = 0.0) -> ChatOpenAI:
    """Return a ChatOpenAI talking to Ollama's OpenAI-compatible API."""
    return ChatOpenAI(
        base_url=OLLAMA_BASE_URL,
        model=MODEL,
        api_key=API_KEY,
        temperature=temperature,
    )
