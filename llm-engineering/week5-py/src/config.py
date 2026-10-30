"""Shared configuration for the Week 5 local RAG project.

NOTE: importing this module FIRST (before langchain_ollama / httpx / ollama)
also installs a small SSL shim - see _install_ssl_shim() below.
"""
import os
import ssl
from pathlib import Path

from dotenv import load_dotenv


def _install_ssl_shim() -> None:
    """Work around a local OpenSSL 'applink' bug in this machine's Python build.

    On this environment, ssl.create_default_context() crashes
    ("OPENSSL_Uplink ... no OPENSSL_Applink") whenever OpenSSL tries to load
    CA certificates. The httpx/ollama clients build such a context eagerly at
    construction time, even though we only ever talk to Ollama over plain
    http://localhost (no TLS handshake, so the CA bundle is never actually
    used). We replace create_default_context with a bare, certless
    SSLContext, which constructs fine. This is safe here precisely because
    every request is plain HTTP to localhost. Remove this shim if your Python
    build does not have the applink bug.
    """
    def _bare_context(*args, **kwargs):
        return ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)

    ssl.create_default_context = _bare_context
    ssl._create_default_https_context = _bare_context


_install_ssl_shim()

load_dotenv(override=True)

# --- Ollama endpoint and models (all local) ---
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
CHAT_MODEL = os.getenv("CHAT_MODEL", "llama3.2")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")

# --- Paths ---
PROJECT_ROOT = Path(__file__).resolve().parent.parent
KNOWLEDGE_DIR = PROJECT_ROOT / "knowledge"
CHROMA_DIR = PROJECT_ROOT / "chroma_db"
COLLECTION_NAME = "insurellm"

# --- Chunking ---
CHUNK_SIZE = 500
CHUNK_OVERLAP = 100
