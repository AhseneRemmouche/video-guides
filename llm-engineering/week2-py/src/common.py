"""Shared helpers for the Week 2 scripts.

Everything here talks to a LOCAL Ollama server through its OpenAI-compatible
endpoint. No cloud API keys are required. The course originally uses paid
frontier models (OpenAI, Anthropic, Google, etc.); here we route every call to
Ollama so the code can actually run for free on a local machine.
"""

import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(override=True)

BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
API_KEY = os.getenv("OLLAMA_API_KEY", "ollama")
MODEL = os.getenv("MODEL", "llama3.2")
MODEL_B = os.getenv("MODEL_B", "dolphin3:8b")


def get_client():
    """Return an OpenAI SDK client pointed at the local Ollama server."""
    return OpenAI(base_url=BASE_URL, api_key=API_KEY)


def banner(title):
    line = "=" * 70
    print(line)
    print(title)
    print(line)
