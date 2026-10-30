# Reconstructed to match the course's Google Colab notebook for this day.
# Standard QLoRA/PEFT code; runs on a GPU (e.g. Colab). Not executed here (no GPU).
#
# Week 7 - Day 3 / Day 4: the actual QLoRA training run.
# Freeze the 4-bit base model, attach LoRA adapters to the attention projections,
# and fine-tune only those adapters with TRL's SFTTrainer. A DataCollator for
# completion-only LM masks out the prompt so the model is trained only to predict
# the price token(s) after "Price is $". Progress is logged to Weights & Biases and
# checkpoints are pushed to the HuggingFace Hub.

import os
from datetime import datetime

import torch
import wandb
from google.colab import userdata
from huggingface_hub import login
from datasets import load_dataset
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
from peft import LoraConfig
from trl import SFTTrainer, SFTConfig, DataCollatorForCompletionOnlyLM


# ----------------------------------------------------------------------------
# Constants
# ----------------------------------------------------------------------------

BASE_MODEL = "meta-llama/Meta-Llama-3.1-8B"
PROJECT_NAME = "pricer"
HF_USER = "ed-donner"  # change to your own HuggingFace username

DATASET_NAME = f"{HF_USER}/pricer-data"
MAX_SEQUENCE_LENGTH = 182

# Unique, timestamped run name so every run is its own Hub repo / W&B run.
RUN_NAME = f"{datetime.now():%Y-%m-%d_%H.%M.%S}"
PROJECT_RUN_NAME = f"{PROJECT_NAME}-{RUN_NAME}"
HUB_MODEL_NAME = f"{HF_USER}/{PROJECT_RUN_NAME}"

# --- QLoRA hyperparameters ---
LORA_R = 32                 # adapter rank (start 8, double to 16, then 32)
LORA_ALPHA = 64             # scaling factor; rule of thumb alpha = 2 * r
TARGET_MODULES = ["q_proj", "v_proj", "k_proj", "o_proj"]  # the attention layers
LORA_DROPOUT = 0.1          # regularization: drop 10% of neurons each step
QUANT_4_BIT = True

# --- Training hyperparameters ---
EPOCHS = 3                  # instructor ran 3 (best checkpoint ~end of epoch 3);
                            # a single epoch already gives strong results and is far cheaper.
BATCH_SIZE = 16             # 16 fits an A100 (40GB); use 1 (or 2-4) on a T4.
GRADIENT_ACCUMULATION_STEPS = 1
LEARNING_RATE = 1e-4
LR_SCHEDULER_TYPE = "cosine"
WARMUP_RATIO = 0.03
OPTIMIZER = "paged_adamw_32bit"  # good convergence; memory-hungry. Swap for a
                                 # cheaper optimizer if you run out of memory.

# --- Admin / logging ---
STEPS = 50                  # log training loss to W&B every 50 steps
SAVE_STEPS = 5000           # push a checkpoint to the Hub every 5000 steps
LOG_TO_WANDB = True


# ----------------------------------------------------------------------------
# Log in to HuggingFace and Weights & Biases
# ----------------------------------------------------------------------------

hf_token = userdata.get("HF_TOKEN")
login(hf_token, add_to_git_credential=True)

if LOG_TO_WANDB:
    wandb_api_key = userdata.get("WANDB_API_KEY")
    os.environ["WANDB_API_KEY"] = wandb_api_key
    wandb.login()
    os.environ["WANDB_PROJECT"] = PROJECT_NAME
    os.environ["WANDB_LOG_MODEL"] = "checkpoint"
    os.environ["WANDB_WATCH"] = "gradients"


# ----------------------------------------------------------------------------
# Data
# ----------------------------------------------------------------------------

dataset = load_dataset(DATASET_NAME)
train = dataset["train"]
test = dataset["test"]

print(f"Training on {len(train):,} items; holding out {len(test):,} test items")
print("Example training text:\n")
print(train[0]["text"])


# ----------------------------------------------------------------------------
# Quantization config + tokenizer + frozen base model
# ----------------------------------------------------------------------------

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

tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, trust_remote_code=True)
tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"

base_model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    quantization_config=quant_config,
    device_map="auto",
)
base_model.generation_config.pad_token_id = tokenizer.pad_token_id
print(f"Memory footprint: {base_model.get_memory_footprint() / 1e6:,.1f} MB")


# ----------------------------------------------------------------------------
# Completion-only data collator
# ----------------------------------------------------------------------------
#
# We only want the model to learn the token(s) AFTER "Price is $" - not how to
# rewrite the product description. The collator masks everything up to and
# including the response template so the loss is computed only on the price.

response_template = "Price is $"
collator = DataCollatorForCompletionOnlyLM(response_template, tokenizer=tokenizer)


# ----------------------------------------------------------------------------
# LoRA config (the QLoRA adapters)
# ----------------------------------------------------------------------------

lora_config = LoraConfig(
    r=LORA_R,
    lora_alpha=LORA_ALPHA,
    target_modules=TARGET_MODULES,
    lora_dropout=LORA_DROPOUT,
    bias="none",
    task_type="CAUSAL_LM",
)


# ----------------------------------------------------------------------------
# SFT training config
# ----------------------------------------------------------------------------

train_config = SFTConfig(
    output_dir=PROJECT_RUN_NAME,
    num_train_epochs=EPOCHS,
    per_device_train_batch_size=BATCH_SIZE,
    gradient_accumulation_steps=GRADIENT_ACCUMULATION_STEPS,
    learning_rate=LEARNING_RATE,
    lr_scheduler_type=LR_SCHEDULER_TYPE,
    warmup_ratio=WARMUP_RATIO,
    optim=OPTIMIZER,
    max_grad_norm=0.3,
    weight_decay=0.001,
    max_seq_length=MAX_SEQUENCE_LENGTH,
    dataset_text_field="text",
    # logging
    logging_steps=STEPS,
    report_to="wandb" if LOG_TO_WANDB else "none",
    run_name=RUN_NAME,
    # saving / pushing to the Hub
    save_strategy="steps",
    save_steps=SAVE_STEPS,
    push_to_hub=True,
    hub_model_id=HUB_MODEL_NAME,
    hub_strategy="every_save",
    hub_private_repo=True,
    # misc
    save_total_limit=10,
    bf16=True,
    group_by_length=True,
    seed=42,
)


# ----------------------------------------------------------------------------
# Trainer
# ----------------------------------------------------------------------------

trainer = SFTTrainer(
    model=base_model,
    train_dataset=train,
    peft_config=lora_config,
    args=train_config,
    data_collator=collator,
    processing_class=tokenizer,  # older TRL versions use tokenizer=tokenizer
)


# ----------------------------------------------------------------------------
# Train, then push the final adapter to the Hub
# ----------------------------------------------------------------------------

if __name__ == "__main__":
    trainer.train()
    trainer.model.push_to_hub(PROJECT_RUN_NAME, private=True)
    print(f"Saved adapter to the Hub: {HUB_MODEL_NAME}")
    if LOG_TO_WANDB:
        wandb.finish()
