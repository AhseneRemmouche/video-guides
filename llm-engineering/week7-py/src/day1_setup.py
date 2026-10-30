# Reconstructed to match the course's Google Colab notebook for this day.
# Standard QLoRA/PEFT code; runs on a GPU (e.g. Colab). Not executed here (no GPU).
#
# Week 7 - Day 1 / Day 2: pick the open-source base model (Llama 3.1 8B), load it
# quantized to 4-bit with BitsAndBytes (QLoRA), load the pricing dataset from the
# HuggingFace Hub (built back in Week 6), and show how a training prompt is built.
#
# The big idea (QLoRA): we do NOT fine-tune the 8B base weights. We freeze the
# quantized base model and later (day 3/4) train small low-rank LoRA adapter
# matrices that are applied on top of a few target modules (the attention layers).

import os

import torch
from google.colab import userdata  # on Colab; for local runs read os.environ instead
from huggingface_hub import login
from datasets import load_dataset
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig


# ----------------------------------------------------------------------------
# Constants
# ----------------------------------------------------------------------------

# The base model. Llama 3.1 comes in 8B / 70B / 405B; the 8B is the only one that
# realistically fits on a single affordable GPU box once quantized.
# We use the plain *base* (foundation) model, NOT the "-Instruct" variant, because
# we train it for one fixed task with one fixed prompt structure.
BASE_MODEL = "meta-llama/Meta-Llama-3.1-8B"

# The pricing dataset built in Week 6 and pushed to the HuggingFace Hub.
# Each row has a "text" field (the prompt, ending in "Price is $NNN") and a
# numeric "price" field. Swap in your own username if you uploaded your own copy.
HF_USER = "ed-donner"
DATASET_NAME = f"{HF_USER}/pricer-data"

# Every training "text" was curated in Week 6 to be at most ~179 tokens. We leave a
# little headroom (beginning-of-sequence + any padding/eos tokens) so the all-important
# final price token is never truncated.
MAX_SEQUENCE_LENGTH = 182

# Quantization choice: True -> 4-bit (fits the ~15GB T4), False -> 8-bit.
QUANT_4_BIT = True


# ----------------------------------------------------------------------------
# Log in to the HuggingFace Hub (needed for the gated Llama weights + the dataset)
# ----------------------------------------------------------------------------

hf_token = userdata.get("HF_TOKEN")  # set this as a Colab secret
login(hf_token, add_to_git_credential=True)


# ----------------------------------------------------------------------------
# Load the pricing dataset
# ----------------------------------------------------------------------------

dataset = load_dataset(DATASET_NAME)
train = dataset["train"]
test = dataset["test"]

print(f"Training items: {len(train):,}")
print(f"Test items: {len(test):,}")

# A training data point: the prompt with the price baked in at the end.
# Example "text":
#   How much does this cost to the nearest dollar?
#
#   <product title and description, truncated to ~179 tokens>
#
#   Price is $226.00
# and a separate numeric field: price = 226.0
print("\nFirst TRAINING item text:\n")
print(train[0]["text"])
print("\nprice field:", train[0]["price"])

# A test data point looks identical EXCEPT the price is withheld - the text stops at
# "Price is $" and it is the model's job to predict the next token (the price).
print("\nFirst TEST item text:\n")
print(test[0]["text"])
print("\n(true price, used only for scoring):", test[0]["price"])


# ----------------------------------------------------------------------------
# Tokenizer
# ----------------------------------------------------------------------------

# Llama 3.1 has a convenient property for this task: every integer 0..999 maps to a
# SINGLE token, so predicting a 3-digit price becomes "predict one token correctly".
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, trust_remote_code=True)
tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"

# Quick sanity check on the one-token-per-price property.
for number in ["0", "1", "10", "100", "999", "1000"]:
    tokens = tokenizer.encode(number, add_special_tokens=False)
    print(f"{number:>5} -> {tokens}")


# ----------------------------------------------------------------------------
# 4-bit (QLoRA) quantization config via BitsAndBytes
# ----------------------------------------------------------------------------
#
# nf4           : interpret each 4-bit value on a normal (gaussian) distribution
# double_quant  : a second quantization pass over the quantization constants
#                 (~10-20% extra memory savings, almost free in quality)
# compute_dtype : bfloat16 during the forward/backward math (faster, tiny quality cost)
#
# 8-bit alternative is shown for reference; 4-bit gets the model down to ~5.6GB vs
# ~9GB (8-bit) vs ~32GB (full fp32).

if QUANT_4_BIT:
    quant_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_quant_type="nf4",
    )
else:
    quant_config = BitsAndBytesConfig(
        load_in_8bit=True,
        bnb_8bit_compute_dtype=torch.bfloat16,
    )


# ----------------------------------------------------------------------------
# Load the quantized base model
# ----------------------------------------------------------------------------

base_model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    quantization_config=quant_config,
    device_map="auto",
)
base_model.generation_config.pad_token_id = tokenizer.pad_token_id

# ~5,591.5 MB for the 4-bit double-quant version of Llama 3.1 8B.
print(f"\nMemory footprint: {base_model.get_memory_footprint() / 1e6:,.1f} MB")

# Printing the model shows the architecture: embedding -> 32 x LlamaDecoderLayer
# (each with self-attn q_proj/k_proj/v_proj/o_proj, an MLP, SiLU activation and
# RMSNorm layers) -> final RMSNorm -> lm_head. The attention projections are the
# modules we will target with LoRA adapters in day 3/4.
print(base_model)
