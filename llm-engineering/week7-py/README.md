# Week 7 - QLoRA Fine-Tuning (the "Pricer")

Week 7 of Ed Donner's **LLM Engineering** course. We take the open-source
**Llama 3.1 8B** base model, quantize it to 4-bit (QLoRA), and fine-tune small
LoRA adapters so the model predicts a product's price from its description.
The target is to beat the Week 6 baselines and even GPT-4o on average error.

## Files

| File | Day | What it does |
|------|-----|--------------|
| `src/day1_setup.py`    | Day 1-2 | Load the 4-bit base model + the `pricer-data` dataset; inspect the tokenizer's one-token-per-price property and the model architecture. |
| `src/day3_4_train.py`  | Day 3-4 | The actual QLoRA training run: freeze the 4-bit base, attach LoRA adapters to the attention projections, train with TRL's `SFTTrainer`, log to W&B, push the adapter to the HF Hub. |
| `src/day5_evaluate.py` | Day 5   | Load base + trained adapter (`PeftModel`), run inference over the test set, score average absolute error / RMSLE against the baselines. |

## IMPORTANT: this needs a CUDA GPU

QLoRA fine-tuning (and even 4-bit quantized inference) **requires an NVIDIA
CUDA GPU**. In particular:

- **`bitsandbytes`** only ships its 4-bit / 8-bit quantization kernels for
  CUDA. On a CPU-only machine it cannot load the model in 4-bit at all.
- Training the 8B model needs ~15 GB+ of VRAM. The course uses:
  - **Google Colab T4** (free / cheap) with `BATCH_SIZE = 1`, or
  - **Colab A100 (40 GB)** with `BATCH_SIZE = 16` for the full run.
- `torch` + CUDA + `transformers` + `peft` + `trl` is a multi-GB install.

**This machine has no CUDA GPU**, so the code here is **verified for
syntactic validity only** (see "Verification on this machine" below). Nothing
was actually trained or run.

## How to run it ON A GPU (e.g. Google Colab)

The course runs these as Colab notebooks. To run the `.py` files in a GPU
environment:

1. **Get a GPU runtime.** In Colab: Runtime -> Change runtime type -> T4 GPU
   (or A100). Or use any NVIDIA box with recent CUDA drivers.

2. **Install the dependencies** (Colab already has torch/transformers/datasets):
   ```bash
   pip install -q peft trl bitsandbytes wandb accelerate datasets transformers
   ```

3. **Provide secrets.** The code reads them via `google.colab.userdata`
   (Colab Secrets). Set:
   - `HF_TOKEN` - a HuggingFace token with access to the **gated** Llama 3.1
     weights (request access on the model page first) and to the dataset.
   - `WANDB_API_KEY` - a Weights & Biases key (or set `LOG_TO_WANDB = False`).

   Outside Colab, replace the `userdata.get(...)` calls with
   `os.environ[...]` (or `huggingface_hub.login()` interactively).

4. **Day 1-2 - sanity check the setup:**
   ```bash
   python src/day1_setup.py
   ```
   Confirms the dataset loads, the price tokens are single tokens, and prints
   the ~5,591 MB 4-bit memory footprint and the model architecture.

5. **Day 3-4 - train:**
   ```bash
   python src/day3_4_train.py
   ```
   Edit `HF_USER` to your own HuggingFace username so checkpoints push to your
   Hub. Set `EPOCHS = 1` for a far cheaper (still strong) run. Training the
   full 3 epochs on an A100 takes hours and pushes the LoRA adapter to the Hub.

6. **Day 5 - evaluate:**
   ```bash
   python src/day5_evaluate.py
   ```
   Set `RUN_NAME` / `FINETUNED_MODEL` to the run you trained, then score it.
   The course's full run lands around **$47 average error**, beating GPT-4o
   ($76). Inference is light enough for a cheap T4.

## Verification on this machine (CPU-only, no GPU)

Because the heavy, CUDA-only dependencies are intentionally **not installed**
here, verification is limited to confirming the code is **syntactically
valid** Python:

```bash
python -m py_compile src/day1_setup.py src/day3_4_train.py src/day5_evaluate.py
```

This does **not** import torch, load any model, or train anything - it only
parses/compiles the source. That is the full extent of what this machine can
verify. **No fine-tuning was performed.**
