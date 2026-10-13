"""Lab 01: your first call to a model, and what it cost."""
from aie import config
from aie.llm import chat

print(f"Server: {config.BASE_URL}   Model: {config.MODEL}\n")

reply = chat([
    {"role": "system", "content": "You are a helpful assistant. Answer in one sentence."},
    {"role": "user", "content": "What is an e-bike?"},
])

print(reply.text)
print(f"\n{reply.input_tokens} input tokens, {reply.output_tokens} output tokens, {reply.seconds:.1f} s")
