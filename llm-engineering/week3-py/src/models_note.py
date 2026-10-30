"""Week 3 - Day 4: the model class + 4-bit quantization  (NOTE ONLY - needs a GPU).

Day 4 of the course loads a real transformer at 4-bit precision with bitsandbytes
so an 8B model fits a small GPU, then calls model.generate(). bitsandbytes 4-bit
quantization REQUIRES CUDA, and this machine has no GPU, so we do NOT run it here.
This script only prints the code and explains why it is skipped.
"""

import textwrap

CODE = '''\
import gc
import torch
from transformers import (
    AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, TextStreamer,
)

LLAMA = "meta-llama/Meta-Llama-3.1-8B-Instruct"   # gated: accept Meta's terms first
messages = [
    {"role": "system", "content": "You are a helpful assistant"},
    {"role": "user", "content": "Tell a light-hearted joke for a room of Data Scientists"},
]

# 4-bit quantization config - bitsandbytes, CUDA only.
quant_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_quant_type="nf4",
)

tokenizer = AutoTokenizer.from_pretrained(LLAMA)
tokenizer.pad_token = tokenizer.eos_token
inputs = tokenizer.apply_chat_template(
    messages, return_tensors="pt", add_generation_prompt=True
).to("cuda")                                   # <-- requires a CUDA GPU

model = AutoModelForCausalLM.from_pretrained(
    LLAMA, device_map="auto", quantization_config=quant_config
)
print(f"Memory footprint: {model.get_memory_footprint() / 1e9:,.1f} GB")  # ~5.5 GB at 4-bit
streamer = TextStreamer(tokenizer)
model.generate(inputs, max_new_tokens=80, streamer=streamer)

del model, inputs, tokenizer, streamer
gc.collect(); torch.cuda.empty_cache()
'''


def main():
    print("=" * 70)
    print("Week 3 Day 4: 4-bit quantized model generation - NOT RUN (no GPU).")
    print("=" * 70)
    print(textwrap.dedent("""
        Why this is skipped on this machine:
          * BitsAndBytesConfig(load_in_4bit=True) uses the `bitsandbytes` library,
            whose 4-bit kernels only run on an NVIDIA CUDA GPU.
          * The code calls `.to("cuda")` and `device_map="auto"`, both of which
            need a GPU. torch.cuda.is_available() is False here.
          * Llama 3.1 is also a GATED model: you must accept Meta's licence on the
            model page and log in with an HF token before it will download.

        To run it as the course does, use a GPU runtime (e.g. Google Colab T4)
        with: pip install transformers accelerate bitsandbytes

        The exact Day 4 code:
    """))
    print(CODE)


if __name__ == "__main__":
    main()
