#!/usr/bin/env python
import os
import sys
import warnings
from datetime import datetime
from pathlib import Path

warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")


def _patch_ssl_for_local():
    """Work around a Windows OpenSSL 'applink' crash on this machine.

    On this box the uv-managed CPython aborts hard with
    `OPENSSL_Uplink(...): no OPENSSL_Applink` the moment any code calls
    `ssl.create_default_context()` (it loads the trust store through a file/
    store BIO that needs the applink table, which this build doesn't export).
    aiohttp -- pulled in transitively by openai/litellm/crewai -- calls it at
    IMPORT time, so merely `import crewai` would crash before the crew ever
    runs.

    This crew only ever talks to local Ollama over plain HTTP
    (http://localhost:11434) and to no TLS endpoint, so we replace
    create_default_context with one that builds a bare client context and
    skips the crashing trust-store load. If you point this at a real HTTPS
    service, remove this shim and fix the OpenSSL install instead.
    """
    import ssl

    _SSLContext = ssl.SSLContext

    def _safe_default_context(*args, **kwargs):
        ctx = _SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx

    ssl.create_default_context = _safe_default_context
    # Some stdlib/3rd-party code reads these module-level hooks directly.
    ssl._create_default_https_context = _safe_default_context

    # Libraries like requests/urllib3 (used by chromadb's optional telemetry)
    # build their OWN context and then call load_verify_locations(cafile=...)
    # directly -- a file-based BIO that triggers the exact same applink abort.
    # Neutralise those file/store cert loads too (we don't verify TLS here).
    def _noop_load_verify_locations(self, cafile=None, capath=None, cadata=None):
        return None

    def _noop_load_default_certs(self, *args, **kwargs):
        return None

    ssl.SSLContext.load_verify_locations = _noop_load_verify_locations
    ssl.SSLContext.load_default_certs = _noop_load_default_certs


def _bootstrap_local_env():
    """Make sure LiteLLM/CrewAI talk to the local Ollama server, not OpenAI.

    CrewAI uses LiteLLM under the hood. A model id like `ollama/llama3.2`
    routes to Ollama, which LiteLLM reaches at OLLAMA_API_BASE. We default it
    to the local server if the caller hasn't set it. We also set a dummy
    OPENAI_API_KEY so that any library code that merely constructs an OpenAI
    client at import time doesn't crash -- nothing paid is actually called.
    """
    os.environ.setdefault("OLLAMA_API_BASE", "http://localhost:11434")
    os.environ.setdefault("OPENAI_API_KEY", "sk-local-ollama-not-used")
    # Keep CrewAI's own telemetry quiet/offline.
    os.environ.setdefault("CREWAI_DISABLE_TELEMETRY", "true")
    os.environ.setdefault("OTEL_SDK_DISABLED", "true")
    # chromadb (used by crew memory) has its own posthog telemetry that makes an
    # HTTPS call; disable it so nothing phones home during the run.
    os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")


def run():
    """
    Run the stock_picker research crew against local Ollama.
    """
    _patch_ssl_for_local()
    _bootstrap_local_env()

    # Output files declared in tasks.yaml live under ./output
    Path("output").mkdir(exist_ok=True)
    Path("memory").mkdir(exist_ok=True)

    # Imported after env bootstrap so model routing is set before CrewAI loads.
    from stock_picker.crew import StockPicker

    inputs = {
        'sector': 'Technology',
        "current_date": str(datetime.now()),
    }

    print(f"Using Ollama at {os.environ['OLLAMA_API_BASE']} (models: ollama/llama3.2)\n")

    # Create and run the crew
    result = StockPicker().crew().kickoff(inputs=inputs)

    # Print the result
    print("\n\n=== FINAL DECISION ===\n\n")
    print(result.raw)


if __name__ == "__main__":
    run()
