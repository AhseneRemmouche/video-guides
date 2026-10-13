"""Settings read from environment variables, with defaults for a local Ollama server."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
EVALS = ROOT / "evals"
PROMPTS = ROOT / "prompts"
RUNS = ROOT / "runs"


def _load_dotenv():
    env = ROOT / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


_load_dotenv()

BASE_URL = os.environ.get("AIE_BASE_URL", "http://localhost:11434/v1")
API_KEY = os.environ.get("AIE_API_KEY", "ollama")
MODEL = os.environ.get("AIE_MODEL", "llama3.2")
JUDGE_MODEL = os.environ.get("AIE_JUDGE_MODEL", "gemma4")
EMBED_MODEL = os.environ.get("AIE_EMBED_MODEL", "nomic-embed-text")
# Thinking models (gemma4, gpt-5...) spend extra hidden tokens before answering. "none" turns that off where supported.
REASONING_EFFORT = os.environ.get("AIE_REASONING_EFFORT", "none")
