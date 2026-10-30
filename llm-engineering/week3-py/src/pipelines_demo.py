"""Week 3 - Day 2: HuggingFace `pipeline` on CPU.

The course runs a whole zoo of pipelines (sentiment, NER, QA, summarization,
translation, zero-shot, text-generation, image + audio) on a Colab GPU. Here we
run the two lightest ones on CPU with small models so they actually complete:

  * sentiment-analysis - the default tiny DistilBERT SST-2 classifier.
  * summarization       - sshleifer/distilbart-cnn-6-6, a small distilled BART.

Both download their weights from the HuggingFace hub on first run (a few hundred
MB for the summarizer). If the download is blocked (corporate TLS) or too slow,
the script reports the exact error and keeps going - the point is to show the
API, which is identical to the GPU version minus `device=0`.

The heavier pipelines (text-generation, translation, image/audio) are left as
comments; they work the same way but pull bigger models.
"""

import torch
from transformers import pipeline

# device=-1 is CPU for transformers pipelines; device=0 would be the first GPU.
# This machine has no GPU, so we force CPU.
DEVICE = 0 if torch.cuda.is_available() else -1


def sentiment_analysis():
    """Positive / negative classification of a sentence (tiny default model)."""
    print("\n=== sentiment-analysis ===")
    classifier = pipeline("sentiment-analysis", device=DEVICE)
    result = classifier("I am super excited to be on the way to LLM mastery!")
    print("Input :", "I am super excited to be on the way to LLM mastery!")
    print("Result:", result)
    # -> [{'label': 'POSITIVE', 'score': 0.999...}]


def summarization():
    """Summarize a short paragraph with a small distilled BART model."""
    print("\n=== summarization (sshleifer/distilbart-cnn-6-6) ===")
    summarizer = pipeline(
        "summarization", model="sshleifer/distilbart-cnn-6-6", device=DEVICE
    )
    text = (
        "The HuggingFace transformers library is an incredibly versatile and powerful "
        "tool for natural language processing (NLP). It allows users to perform a wide "
        "range of tasks such as text classification, named entity recognition, and "
        "question answering, among others. It's an extremely popular library that's "
        "widely used by the open-source data science community. It lowers the barrier "
        "to entry into the field by providing Data Scientists with a productive, "
        "convenient way to work with transformer models."
    )
    summary = summarizer(text, max_length=60, min_length=20, do_sample=False)
    print("Summary:", summary[0]["summary_text"])


# --- Heavier pipelines (same API, bigger downloads) --------------------------
# ner = pipeline("ner", grouped_entities=True, device=DEVICE)
# qa  = pipeline("question-answering", device=DEVICE)
# gen = pipeline("text-generation", device=DEVICE)          # downloads GPT-2
# tr  = pipeline("translation_en_to_fr", device=DEVICE)     # downloads T5
# zsc = pipeline("zero-shot-classification", device=DEVICE) # downloads BART-MNLI
# Image generation uses the sibling `diffusers` library (Stable Diffusion) and
# text-to-speech uses microsoft/speecht5_tts; both are GPU-oriented in the course.


def _run(step):
    """Run one demo, but turn a download/TLS failure into a clear message instead
    of a crash, so the rest of the script (and the point being made) survives."""
    try:
        step()
    except Exception as exc:  # network / TLS / hub errors land here
        print(f"[could not run {step.__name__}] {type(exc).__name__}: {exc}")
        print("  (The code is correct; this is a model-download/network issue.)")


def main():
    print(f"CUDA available: {torch.cuda.is_available()} (DEVICE={DEVICE}, -1 means CPU)")
    _run(sentiment_analysis)
    _run(summarization)


if __name__ == "__main__":
    main()
