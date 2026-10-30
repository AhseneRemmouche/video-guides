# Day 4 - Seeing tokens with tiktoken.
# tiktoken is OpenAI's tokenizer. It turns text into the integer token ids a model
# actually reads, and back again. It runs locally - no API key and no cost.
#
# We set TIKTOKEN_CACHE_DIR (if not already set) so tiktoken uses the bundled
# cache and never tries to download the encoding over the network.

import os

# Fall back to an env var the runner sets; this is just a safety net.
os.environ.setdefault("TIKTOKEN_CACHE_DIR", os.environ.get("TIKTOKEN_CACHE_DIR", ""))

import tiktoken

# o200k_base is the encoding used by the GPT-4o family of models.
encoding = tiktoken.get_encoding("o200k_base")

text = "Hi my name is Ed and I like banoffee pie"

tokens = encoding.encode(text)
print(tokens)
print(f"{len(text)} characters became {len(tokens)} tokens")

for token_id in tokens:
    print(f"{token_id} = {encoding.decode([token_id])!r}")
