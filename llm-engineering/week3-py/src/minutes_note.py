"""Week 3 - Day 5: Meeting Minutes pipeline  (NOTE ONLY - needs a GPU).

Day 5 combines a frontier model with an open-source one:
  1) OpenAI Whisper transcribes an audio recording (audio -> text).
  2) Llama 3.1 8B, 4-bit quantized, turns the transcript into markdown minutes.

Step 2 needs the same 4-bit bitsandbytes + CUDA setup as Day 4, so this pipeline
CANNOT run on this CPU-only machine. This script only prints the steps and code.
(Whisper transcription via the OpenAI API would need OPENAI_API_KEY; the local
open-source summarization step is the part that strictly needs the GPU.)
"""

import textwrap

CODE = '''\
import os, torch
from openai import OpenAI
from transformers import (
    AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, TextStreamer,
)

AUDIO_MODEL = "whisper-1"
LLAMA = "meta-llama/Meta-Llama-3.1-8B-Instruct"

# 1) Transcribe audio -> text with OpenAI Whisper (frontier step).
openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
with open("denver_extract.mp3", "rb") as f:
    transcript = openai.audio.transcriptions.create(
        model=AUDIO_MODEL, file=f, response_format="text")

# 2) Build the chat messages (system + user with the transcript).
messages = [
    {"role": "system", "content":
        "You are an assistant that produces minutes of meetings from transcripts, "
        "with summary, key discussion points, takeaways and action items with owners, "
        "in markdown."},
    {"role": "user", "content":
        "Below is an extract transcript of a Denver council meeting. Please write "
        "minutes in markdown, including a summary with attendees, location and date; "
        "discussion points; takeaways; and action items with owners.\\n" + transcript},
]

# 3) Open-source step: Llama 3.1 8B, 4-bit quantized (CUDA only), writes minutes.
quant_config = BitsAndBytesConfig(
    load_in_4bit=True, bnb_4bit_use_double_quant=True,
    bnb_4bit_compute_dtype=torch.bfloat16, bnb_4bit_quant_type="nf4")
tokenizer = AutoTokenizer.from_pretrained(LLAMA)
tokenizer.pad_token = tokenizer.eos_token
inputs = tokenizer.apply_chat_template(
    messages, return_tensors="pt", add_generation_prompt=True).to("cuda")
streamer = TextStreamer(tokenizer)
model = AutoModelForCausalLM.from_pretrained(
    LLAMA, device_map="auto", quantization_config=quant_config)
outputs = model.generate(inputs, max_new_tokens=2000, streamer=streamer)
print(tokenizer.decode(outputs[0]))
'''


def main():
    print("=" * 70)
    print("Week 3 Day 5: Whisper -> Llama meeting-minutes pipeline - NOT RUN (no GPU).")
    print("=" * 70)
    print(textwrap.dedent("""
        The pipeline, step by step:
          1. OpenAI Whisper ("whisper-1") transcribes an audio file to text.
             (Frontier step; would need OPENAI_API_KEY.)
          2. The transcript is wrapped in a system+user chat prompt asking for
             meeting minutes in markdown.
          3. Llama 3.1 8B, loaded 4-bit quantized with bitsandbytes on a CUDA GPU,
             generates the minutes (summary, discussion points, takeaways, action
             items with owners), streamed as it goes.

        Why it is skipped here:
          * Step 3 is exactly the Day 4 4-bit setup: bitsandbytes 4-bit kernels +
            .to("cuda") require an NVIDIA GPU. torch.cuda.is_available() is False.
          * Llama 3.1 is gated (accept Meta's licence + HF token to download).

        Run it on a GPU runtime (e.g. Colab T4) with:
          pip install openai transformers accelerate bitsandbytes

        The exact Day 5 code:
    """))
    print(CODE)


if __name__ == "__main__":
    main()
