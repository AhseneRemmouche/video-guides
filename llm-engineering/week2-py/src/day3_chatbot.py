"""Day 3 - a chatbot that keeps conversation history.

The course builds this with a Gradio UI. Here we keep the same chat(message,
history, system) function but drive it with a short scripted conversation so it
runs headless against local Ollama and proves it keeps context across turns.
"""

from common import MODEL, banner, get_client

client = get_client()

MAX_TOKENS = 120

SYSTEM = (
    "You are a helpful assistant in a clothes store. Keep answers to one short "
    "sentence. Hats are 60% off and most other items are 50% off."
)


def chat(message, history, system):
    """history is a list of {'role','content'} dicts (prior turns)."""
    messages = [{"role": "system", "content": system}]
    messages += history
    messages.append({"role": "user", "content": message})
    response = client.chat.completions.create(
        model=MODEL, messages=messages, max_tokens=MAX_TOKENS
    )
    return response.choices[0].message.content


def run_scripted_conversation():
    banner("Scripted 3-turn conversation (shows history is kept)")

    history = []
    scripted_turns = [
        "Hi, I'm looking for a hat.",
        "How much discount did you say hats have?",
        "Great - and what about a scarf then?",
    ]

    for turn in scripted_turns:
        print(f"\nUSER: {turn}")
        reply = chat(turn, history, SYSTEM)
        print(f"BOT : {reply}")
        # append both sides so the next turn has full context
        history.append({"role": "user", "content": turn})
        history.append({"role": "assistant", "content": reply})

    print("\n--- Note ---")
    print(
        "Turn 2 ('How much discount did you say') only makes sense because the "
        "bot still sees turn 1 in history. That is the context being kept."
    )


if __name__ == "__main__":
    run_scripted_conversation()
