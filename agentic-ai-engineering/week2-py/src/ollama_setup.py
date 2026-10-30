"""
Shared Ollama wiring for the OpenAI Agents SDK.

The `openai-agents` SDK defaults to the real OpenAI cloud (and its Responses API +
tracing dashboard). This module repoints it at a LOCAL Ollama server speaking
OpenAI's chat-completions dialect, and disables tracing (no OpenAI key to upload
traces with).

Import `make_model()` in each script and pass the result as `model=` on every Agent.
"""

import os

from dotenv import load_dotenv
from openai import AsyncOpenAI
from agents import (
    set_default_openai_client,
    set_default_openai_api,
    set_tracing_disabled,
    OpenAIChatCompletionsModel,
)

load_dotenv(override=True)

BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
API_KEY = os.getenv("OPENAI_API_KEY", "ollama")  # dummy; Ollama ignores it
MODEL_NAME = os.getenv("OLLAMA_MODEL", "llama3.2")

# One shared async client pointed at Ollama's OpenAI-compatible endpoint.
_client = AsyncOpenAI(base_url=BASE_URL, api_key=API_KEY)

# Make the whole SDK default to Ollama + chat-completions, and switch off tracing
# (the hosted tracing dashboard is OpenAI-only and needs a real key).
set_default_openai_client(_client)
set_default_openai_api("chat_completions")
set_tracing_disabled(True)


def make_model() -> OpenAIChatCompletionsModel:
    """Return a fresh chat-completions model bound to the local Ollama client."""
    return OpenAIChatCompletionsModel(model=MODEL_NAME, openai_client=_client)
