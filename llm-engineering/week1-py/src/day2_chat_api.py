# Day 2 - The Chat Completions API, two ways, against a LOCAL Ollama model.
# This is the lab that genuinely uses a local model in the course.
#   1) a raw requests.post to the OpenAI-compatible endpoint
#   2) the same call through the openai client library
# Both hit http://localhost:11434 - no paid key, no network beyond localhost.

import os

import requests
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(override=True)

BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
MODEL = os.getenv("MODEL", "llama3.2")

PROMPT = "Tell me a fun fact in one short sentence."

# --- 1. Raw HTTP endpoint -----------------------------------------------------
# This is all the openai library does under the hood: an HTTP POST with JSON.
headers = {"Authorization": "Bearer ollama", "Content-Type": "application/json"}
payload = {
    "model": MODEL,
    "messages": [{"role": "user", "content": PROMPT}],
    "max_tokens": 80,
}
response = requests.post(f"{BASE_URL}/chat/completions", headers=headers, json=payload)
raw_reply = response.json()["choices"][0]["message"]["content"]
print("--- 1. raw requests.post ---")
print(raw_reply)

# --- 2. The same call with the openai client library -------------------------
# Change base_url + api_key and the identical client works against Ollama.
client = OpenAI(base_url=BASE_URL, api_key="ollama")
completion = client.chat.completions.create(
    model=MODEL,
    messages=[{"role": "user", "content": PROMPT}],
    max_tokens=80,
)
print("\n--- 2. openai client library ---")
print(completion.choices[0].message.content)
