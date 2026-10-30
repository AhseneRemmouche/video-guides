"""Explains the real Week 6 finale (OpenAI fine-tuning) that is NOT run here.

The grand finale of Ed Donner's Week 6 is to fine-tune gpt-4o-mini on the
Amazon pricing dataset: build a JSONL training file, kick off a paid OpenAI
fine-tuning job, track it with Weights & Biases, then evaluate the fine-tuned
model against the baselines. All of that needs a paid OpenAI key (and the big
dataset), so it is intentionally not reproduced in this offline project.

This script just prints the note and shows the SHAPE of a JSONL training row.
"""

import json


def main():
    print("=" * 70)
    print("WEEK 6 FINALE: OpenAI fine-tuning  (NOT run in this offline project)")
    print("=" * 70)
    print()
    print("The real course finishes Week 6 by FINE-TUNING a frontier model:")
    print("  1. Convert training items into a JSONL file of chat examples.")
    print("  2. Upload it and launch a PAID OpenAI fine-tuning job")
    print("     (client.fine_tuning.jobs.create on gpt-4o-mini).")
    print("  3. Monitor the job with Weights & Biases (W&B) integration.")
    print("  4. Evaluate the fine-tuned model vs. the ML baselines.")
    print()
    print("We do NOT run this here because it requires:")
    print("  - a paid OpenAI API key (fine-tuning is not free),")
    print("  - the large real Amazon dataset for meaningful training,")
    print("  - a W&B account for tracking.")
    print()
    print("Shape of ONE JSONL training row (one line per example in the file):")
    print("-" * 70)

    example_row = {
        "messages": [
            {
                "role": "system",
                "content": "You estimate prices of items. Reply only with the price, no explanation.",
            },
            {
                "role": "user",
                "content": "How much does this cost?\n\nStark pro laptop in excellent condition, barely used.",
            },
            {
                "role": "assistant",
                "content": "Price is $1623.40",
            },
        ]
    }

    # Each line of the .jsonl file is exactly one such JSON object.
    print(json.dumps(example_row, indent=2))
    print("-" * 70)
    print()
    print("As a single JSONL line it would look like:")
    print(json.dumps(example_row))
    print()
    print("To actually run it you would then do roughly:")
    print("  openai.files.create(file=open('train.jsonl','rb'), purpose='fine-tune')")
    print("  openai.fine_tuning.jobs.create(training_file=<id>, model='gpt-4o-mini')")


if __name__ == "__main__":
    main()
