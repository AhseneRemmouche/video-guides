"""One place that decides which models the labs use."""
import os
from pathlib import Path

from langchain_ollama import ChatOllama, OllamaEmbeddings

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RUNS = ROOT / "runs"

MODEL = os.environ.get("HARBOR_MODEL", "llama3.2")
EMBED_MODEL = os.environ.get("HARBOR_EMBED_MODEL", "nomic-embed-text")
# Ollama's default context window can be far larger than a small GPU holds; 8192 tokens is plenty for these labs.
NUM_CTX = int(os.environ.get("HARBOR_NUM_CTX", "8192"))


def get_model(temperature=0, num_predict=512, **kwargs):
    """The chat model every lab uses. Change HARBOR_MODEL to try another Ollama model.

    num_predict caps the answer length, so a model that never stops can't block the server.
    reasoning=False turns off the hidden "thinking" of models such as gemma4 (much faster here).
    """
    return ChatOllama(model=MODEL, temperature=temperature, num_ctx=NUM_CTX, num_predict=num_predict,
                      reasoning=False, **kwargs)


def get_embeddings():
    return OllamaEmbeddings(model=EMBED_MODEL)
