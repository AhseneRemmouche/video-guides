# Day 4 - The illusion of memory, against a LOCAL Ollama model.
# Every call to an LLM is stateless: it remembers nothing between calls. We create
# the feeling of memory by sending the whole conversation back every time.

import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(override=True)

BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
MODEL = os.getenv("MODEL", "llama3.2")

client = OpenAI(base_url=BASE_URL, api_key="ollama")


def ask(messages):
    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        max_tokens=80,
    )
    return response.choices[0].message.content


# First call: we tell it our name.
print("--- Call 1: introduce myself ---")
print(ask([
    {"role": "system", "content": "You are a helpful assistant. Answer in one short sentence."},
    {"role": "user", "content": "Hi! I'm Ed!"},
]))

# Second call, on its own: it has no idea who we are - call 1 is forgotten.
print("\n--- Call 2: ask my name with NO history (it forgets) ---")
print(ask([
    {"role": "system", "content": "You are a helpful assistant. Answer in one short sentence."},
    {"role": "user", "content": "What's my name?"},
]))

# Fix: replay the whole conversation, including the assistant's earlier reply.
print("\n--- Call 3: ask my name WITH history replayed (it remembers) ---")
print(ask([
    {"role": "system", "content": "You are a helpful assistant. Answer in one short sentence."},
    {"role": "user", "content": "Hi! I'm Ed!"},
    {"role": "assistant", "content": "Hi Ed! How can I help you today?"},
    {"role": "user", "content": "What's my name?"},
]))
