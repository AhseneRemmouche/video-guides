# Reconstructed to match the course's Google Colab notebook for this day.
# Standard QLoRA/PEFT code; runs on a GPU (e.g. Colab). Not executed here (no GPU).
#
# Week 7 - Day 5: evaluate the fine-tuned model.
# Load the 4-bit base model, then load the trained LoRA adapter on top of it with
# PeftModel.from_pretrained (optionally pinning a specific checkpoint revision).
# Run inference over the test set, parse the predicted price, and score the average
# absolute error / RMSLE against the Week 6 baselines and frontier models.
#
# Inference is light enough to run on a cheap T4 box (no training here).

import re
import math

import torch
import matplotlib.pyplot as plt
from google.colab import userdata
from huggingface_hub import login
from datasets import load_dataset
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
from peft import PeftModel


# ----------------------------------------------------------------------------
# Constants
# ----------------------------------------------------------------------------

BASE_MODEL = "meta-llama/Meta-Llama-3.1-8B"
HF_USER = "ed-donner"  # change to your own username / your own run

DATASET_NAME = f"{HF_USER}/pricer-data"

# The trained run and the checkpoint to evaluate. Pick the checkpoint from BEFORE
# the model started to overfit (the instructor used the end of the 3rd epoch).
RUN_NAME = "2024-09-13_13.04.39"
PROJECT_RUN_NAME = f"pricer-{RUN_NAME}"
FINETUNED_MODEL = f"{HF_USER}/{PROJECT_RUN_NAME}"
REVISION = None  # e.g. a commit hash / "checkpoint-5000"; None -> latest on the branch

QUANT_4_BIT = True

# For scoring colored output in the notebook.
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
RESET = "\033[0m"
COLOR_MAP = {"green": GREEN, "orange": YELLOW, "red": RED}

# Week 6 reference results (average absolute error, $) for the final podium.
BASELINES = {
    "Constant (avg)": 146,
    "Linear Regression (features)": 139,
    "Random Forest": 97,
    "Human": 127,
    "GPT-4o-mini": 81,
    "GPT-4o (frontier best)": 76,
    "Base Llama 3.1 (4-bit, untrained)": 396,
}


# ----------------------------------------------------------------------------
# Log in and load data
# ----------------------------------------------------------------------------

hf_token = userdata.get("HF_TOKEN")
login(hf_token, add_to_git_credential=True)

dataset = load_dataset(DATASET_NAME)
test = dataset["test"]


# ----------------------------------------------------------------------------
# Load the quantized base model + the trained LoRA adapter
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

# This is the key step for inference on a PEFT model: base + adapter.
if REVISION:
    fine_tuned_model = PeftModel.from_pretrained(base_model, FINETUNED_MODEL, revision=REVISION)
else:
    fine_tuned_model = PeftModel.from_pretrained(base_model, FINETUNED_MODEL)

# ~5.7GB: the 5.6GB 4-bit base plus ~109MB of LoRA adapters.
print(f"Memory footprint: {fine_tuned_model.get_memory_footprint() / 1e6:,.1f} MB")


# ----------------------------------------------------------------------------
# Price parsing + prediction
# ----------------------------------------------------------------------------

def extract_price(text):
    """Pull the first number appearing after 'Price is $' out of a generated string."""
    if "Price is $" in text:
        text = text.split("Price is $")[1]
    text = text.replace(",", "")
    match = re.search(r"[-+]?\d*\.?\d+", text)
    return float(match.group()) if match else 0.0


def model_predict(prompt):
    """Simple strategy: generate a few tokens and read off the price."""
    inputs = tokenizer.encode(prompt, return_tensors="pt").to("cuda")
    attention_mask = torch.ones(inputs.shape, device="cuda")
    outputs = fine_tuned_model.generate(
        inputs,
        attention_mask=attention_mask,
        max_new_tokens=4,
        num_return_sequences=1,
    )
    reply = tokenizer.decode(outputs[0])
    return extract_price(reply)


# A smarter strategy: treat the (really regression) problem as a weighted average
# over the top-k most likely next price tokens, using their softmax probabilities.
# This squeezes out a little more accuracy than taking only the single top token.
TOP_K = 3


def improved_model_predict(prompt):
    inputs = tokenizer.encode(prompt, return_tensors="pt").to("cuda")
    attention_mask = torch.ones(inputs.shape, device="cuda")
    with torch.no_grad():
        outputs = fine_tuned_model(inputs, attention_mask=attention_mask)
        # logits for the next token only -> probabilities via softmax
        next_token_logits = outputs.logits[0, -1, :].to("cpu")
        next_token_probs = torch.nn.functional.softmax(next_token_logits, dim=-1)

    top_prob, top_token_id = next_token_probs.topk(TOP_K)
    prices, weights = [], []
    for prob, token_id in zip(top_prob, top_token_id):
        price = extract_price(tokenizer.decode(token_id))
        if price > 0:
            prices.append(price)
            weights.append(prob.item())

    if not prices:
        return 0.0
    total = sum(weights)
    return sum(p * w for p, w in zip(prices, weights)) / total


# ----------------------------------------------------------------------------
# Tester harness (same structure used throughout the course)
# ----------------------------------------------------------------------------

class Tester:
    def __init__(self, predictor, data, title=None, size=250):
        self.predictor = predictor
        self.data = data
        self.title = title or predictor.__name__.replace("_", " ").title()
        self.size = size
        self.guesses = []
        self.truths = []
        self.errors = []
        self.sles = []
        self.colors = []

    @staticmethod
    def color_for(error, truth):
        if error < 40 or error / truth < 0.2:
            return "green"
        elif error < 80 or error / truth < 0.4:
            return "orange"
        return "red"

    def run_datapoint(self, i):
        datapoint = self.data[i]
        guess = self.predictor(datapoint["text"])
        truth = datapoint["price"]
        error = abs(guess - truth)
        log_error = math.log(truth + 1) - math.log(guess + 1)
        sle = log_error ** 2
        color = self.color_for(error, truth)
        self.guesses.append(guess)
        self.truths.append(truth)
        self.errors.append(error)
        self.sles.append(sle)
        self.colors.append(color)
        title = datapoint["text"].split("\n\n")[1][:20] + "..."
        print(
            f"{COLOR_MAP[color]}{i+1}: Guess: ${guess:,.2f} "
            f"Truth: ${truth:,.2f} Error: ${error:,.2f} "
            f"SLE: {sle:,.2f} Item: {title}{RESET}"
        )

    def chart(self, title):
        max_val = max(max(self.truths), max(self.guesses))
        plt.figure(figsize=(12, 8))
        plt.plot([0, max_val], [0, max_val], color="deepskyblue", lw=2, alpha=0.6)
        plt.scatter(self.truths, self.guesses, s=3, c=self.colors)
        plt.xlabel("Ground Truth")
        plt.ylabel("Model Estimate")
        plt.xlim(0, max_val)
        plt.ylim(0, max_val)
        plt.title(title)
        plt.show()

    def report(self):
        average_error = sum(self.errors) / self.size
        rmsle = math.sqrt(sum(self.sles) / self.size)
        hits = sum(1 for c in self.colors if c == "green")
        title = (
            f"{self.title} Error=${average_error:,.2f} "
            f"RMSLE={rmsle:,.2f} Hits={hits/self.size*100:.1f}%"
        )
        self.chart(title)
        return average_error, rmsle

    def run(self):
        self.error = 0
        for i in range(self.size):
            self.run_datapoint(i)
        return self.report()

    @classmethod
    def test(cls, function, data):
        return cls(function, data).run()


# ----------------------------------------------------------------------------
# Run the evaluation and print the final podium
# ----------------------------------------------------------------------------

if __name__ == "__main__":
    average_error, rmsle = Tester.test(improved_model_predict, test)

    print("\n================ Final podium (avg absolute error, $) ================")
    rows = list(BASELINES.items()) + [("Fine-tuned Llama 3.1 (ours)", round(average_error))]
    for name, err in sorted(rows, key=lambda kv: kv[1]):
        print(f"  {name:<40} ${err}")
    print(f"\nOur fine-tuned model: ${average_error:,.2f} error, RMSLE {rmsle:,.2f}")
    # On the course's full run this lands around $47 - beating GPT-4o ($76).
