"""Day 1 - "multiple providers", routed entirely to local Ollama.

The course calls several hosted providers (OpenAI, Anthropic, Gemini, Groq...)
through the OpenAI SDK by swapping base_url. We keep the same idea but point
every call at the local Ollama OpenAI-compatible endpoint, using two different
local models (llama3.2 and qwen3.5:9b).

This script shows three things:
  1. A plain completion from each of the two local models.
  2. A streaming helper that prints tokens as they arrive.
  3. A short adversarial two-model conversation (llama3.2 vs qwen3.5).
"""

from common import MODEL, MODEL_B, banner, get_client

client = get_client()

MAX_TOKENS = 120


def ask(model, messages):
    response = client.chat.completions.create(
        model=model, messages=messages, max_tokens=MAX_TOKENS
    )
    return response.choices[0].message.content


def stream_answer(model, messages):
    """Stream tokens from a local model, printing them as they arrive."""
    stream = client.chat.completions.create(
        model=model, messages=messages, max_tokens=MAX_TOKENS, stream=True
    )
    collected = ""
    for chunk in stream:
        token = chunk.choices[0].delta.content or ""
        collected += token
        print(token, end="", flush=True)
    print()
    return collected


def multiple_providers():
    banner("1. Two local models answer the same prompt (via Ollama)")
    prompt = [
        {"role": "user", "content": "In one short sentence, say why Python is popular."}
    ]
    for model in (MODEL, MODEL_B):
        print(f"\n--- {model} ---")
        print(ask(model, prompt))


def streaming_demo():
    banner("2. Streaming helper (tokens printed as they arrive)")
    messages = [
        {"role": "user", "content": "Count from 1 to 5 and then say 'done'."}
    ]
    print(f"--- streaming from {MODEL} ---")
    stream_answer(MODEL, messages)


def adversarial_conversation(turns=3):
    banner(f"3. Adversarial conversation: {MODEL} (argues) vs {MODEL_B} (calms)")

    a_system = (
        "You are argumentative and snarky. You disagree with everything the "
        "other person says. Keep replies to ONE short sentence."
    )
    b_system = (
        "You are polite and calm. You try to agree and find common ground. "
        "Keep replies to ONE short sentence."
    )

    a_messages = ["Hi there."]
    b_messages = ["Hi."]

    def call_a():
        messages = [{"role": "system", "content": a_system}]
        for a, b in zip(a_messages, b_messages):
            messages.append({"role": "assistant", "content": a})
            messages.append({"role": "user", "content": b})
        return ask(MODEL, messages)

    def call_b():
        messages = [{"role": "system", "content": b_system}]
        for a, b in zip(a_messages, b_messages):
            messages.append({"role": "user", "content": a})
            messages.append({"role": "assistant", "content": b})
        messages.append({"role": "user", "content": a_messages[-1]})
        return ask(MODEL_B, messages)

    print(f"{MODEL} (A): {a_messages[0]}")
    print(f"{MODEL_B} (B): {b_messages[0]}")

    for _ in range(turns):
        a_next = call_a()
        print(f"\n{MODEL} (A): {a_next}")
        a_messages.append(a_next)

        b_next = call_b()
        print(f"{MODEL_B} (B): {b_next}")
        b_messages.append(b_next)


if __name__ == "__main__":
    multiple_providers()
    streaming_demo()
    adversarial_conversation(turns=3)
