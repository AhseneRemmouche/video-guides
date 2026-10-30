"""Local-LLM price estimation, in the shape of Week 6 "day 4" frontier eval.

The real course asks frontier models (GPT, Claude, Gemini...) to estimate a
product's price from its description and compares the Average Absolute Error to
the ML baselines. We do the same pipeline, but point an OpenAI client at a LOCAL
Ollama server (llama3.2) instead of a paid frontier API. A small local model is
expected to be modest; the goal here is to verify the eval pipeline runs end to
end and to report a real number next to the baselines.
"""

import os
import re

import pandas as pd
from dotenv import load_dotenv
from openai import OpenAI

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(HERE), "data")

load_dotenv(override=True)

BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1")
API_KEY = os.environ.get("OLLAMA_API_KEY", "ollama")
MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2:latest")

N_ITEMS = 5

client = OpenAI(base_url=BASE_URL, api_key=API_KEY)


def messages_for(description: str):
    message = (
        "Estimate the price in US dollars of this product. "
        "Respond with just the price as a number, no explanation and no currency symbol.\n\n"
        f"{description}"
    )
    return [{"role": "user", "content": message}]


def parse_price(text: str) -> float:
    """Pull the first number out of the model's reply."""
    if text is None:
        return 0.0
    cleaned = text.replace(",", "").replace("$", "")
    match = re.search(r"\d+(?:\.\d+)?", cleaned)
    return float(match.group()) if match else 0.0


def llm_price(description: str) -> float:
    response = client.chat.completions.create(
        model=MODEL,
        messages=messages_for(description),
        temperature=0,
        max_tokens=50,
    )
    return parse_price(response.choices[0].message.content)


def main():
    preds_path = os.path.join(DATA_DIR, "baseline_preds.csv")
    if not os.path.exists(preds_path):
        raise SystemExit("Run baselines.py first (needs data/baseline_preds.csv).")

    df = pd.read_csv(preds_path).head(N_ITEMS).reset_index(drop=True)

    print(f"Local model: {MODEL}  via  {BASE_URL}")
    print(f"Estimating prices for {len(df)} test items...\n")

    abs_errors = []
    rf_abs_errors = []
    for _, row in df.iterrows():
        actual = float(row["actual"])
        try:
            guess = llm_price(row["description"])
            err = abs(guess - actual)
        except Exception as exc:  # pragma: no cover - network/runtime guard
            guess = float("nan")
            err = float("nan")
            print(f"  [error calling model: {exc}]")
        abs_errors.append(err)
        rf_abs_errors.append(abs(float(row["rf_pred"]) - actual))

        desc = row["description"]
        if len(desc) > 54:
            desc = desc[:51] + "..."
        print(f"  actual=${actual:8.2f}  llm=${guess:8.2f}  err=${err:7.2f}   {desc}")

    valid = [e for e in abs_errors if e == e]  # drop NaNs
    llm_mae = sum(valid) / len(valid) if valid else float("nan")
    rf_mae = sum(rf_abs_errors) / len(rf_abs_errors)

    print("\n" + "-" * 56)
    print(f"Local LLM ({MODEL}) Average Absolute Error over {len(valid)} items: ${llm_mae:.2f}")
    print(f"RandomForest baseline on the SAME {len(df)} items:            ${rf_mae:.2f}")
    print("-" * 56)

    scores_path = os.path.join(DATA_DIR, "baseline_scores.csv")
    if os.path.exists(scores_path):
        print("\nFull baseline leaderboard (whole test set):")
        scores = pd.read_csv(scores_path).sort_values("avg_abs_error")
        for _, r in scores.iterrows():
            print(f"  ${r['avg_abs_error']:8.2f}   {r['model']}")
        print(f"  ${llm_mae:8.2f}   Local LLM {MODEL} (first {len(df)} items only)")

    print(
        "\nNote: a 3B local model on 5 items is a pipeline check, not a fair "
        "comparison.\nThe course uses frontier models on a large test set."
    )


if __name__ == "__main__":
    main()
