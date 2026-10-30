"""Week 3 - Day 3: Tokenizers, the lower-level API, on CPU.

A tokenizer translates between text (a string) and tokens (a list of ints):
  encode: text  -> tokens
  decode: tokens -> text
It carries a vocab (the fragment<->id mapping) and, for instruct models, a chat
template. Every model has its own tokenizer; using the wrong one gives garbage.

The course uses gated Llama 3.1 here (needs a HF token + accepting Meta's terms).
To keep this runnable with no token, we use UNGATED models instead:
  * gpt2                   - tiny, classic byte-level BPE tokenizer.
  * Qwen/Qwen2-0.5B-Instruct - a modern instruct tokenizer WITH a chat template.
Only small config/vocab files download (a few MB), not model weights.
"""

from transformers import AutoTokenizer

UNGATED_MODEL = "gpt2"
INSTRUCT_MODEL = "Qwen/Qwen2-0.5B-Instruct"  # ungated; has a chat template

TEXT = "I am excited to show Tokenizers in action to my LLM engineers"


def encode_decode(model_id):
    """Encode a sentence to token ids and decode it back; show the split."""
    print(f"\n=== {model_id}: encode / decode ===")
    tokenizer = AutoTokenizer.from_pretrained(model_id)

    tokens = tokenizer.encode(TEXT)
    print("Text          :", TEXT)
    print("Tokens        :", tokens)
    print("Num characters:", len(TEXT))
    print("Num tokens    :", len(tokens))  # ~1 token per ~4 chars of English
    print("Decoded       :", tokenizer.decode(tokens))

    # Decode each id on its own to show exactly where words were split.
    print("Per-token     :", [tokenizer.decode([t]) for t in tokens])

    print("Vocab size    :", tokenizer.vocab_size)


def chat_template(model_id):
    """Instruct models format a chat into the exact prompt string they trained on."""
    print(f"\n=== {model_id}: chat template ===")
    tokenizer = AutoTokenizer.from_pretrained(model_id)

    messages = [
        {"role": "system", "content": "You are a helpful assistant"},
        {"role": "user", "content": "Tell a light-hearted joke for a room of Data Scientists"},
    ]
    # tokenize=False returns the prompt as text so we can read the special-token
    # structure; add_generation_prompt=True tees up the assistant's turn.
    prompt = tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    print("Chat prompt:\n", prompt)


def _run(step, *args):
    try:
        step(*args)
    except Exception as exc:
        print(f"[could not run {step.__name__}({args}) ] {type(exc).__name__}: {exc}")
        print("  (The code is correct; this is a model-download/network issue.)")


def main():
    _run(encode_decode, UNGATED_MODEL)
    _run(encode_decode, INSTRUCT_MODEL)
    _run(chat_template, INSTRUCT_MODEL)


if __name__ == "__main__":
    main()
