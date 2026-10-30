// Week 3 - Day 3: Tokenizers, the transformers.js way.
//
// The Python course uses `from transformers import AutoTokenizer`; transformers.js
// mirrors it: `AutoTokenizer.from_pretrained(id)`, then encode (text -> token ids) and
// decode (token ids -> text). Instruct models also carry a chat template, applied with
// tokenizer.apply_chat_template(messages).
//
// We use Xenova/* tokenizer repos (the transformers.js mirrors) so nothing is gated;
// the tokenizers for Llama 3.1, Phi-3, Qwen2 and Starcoder2 are all published there.
//
// Run with: npm run day3
// NOTE: the first run downloads each tokenizer's files from the HuggingFace hub.
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { AutoTokenizer } from "@huggingface/transformers";

// transformers.js tokenizer mirrors of the course's models.
const LLAMA_MODEL = "Xenova/Meta-Llama-3.1-Tokenizer";
const PHI3_MODEL = "Xenova/Phi-3-mini-4k-instruct";
const QWEN2_MODEL = "Xenova/Qwen2-7B-Instruct-tokenizer";
const STARCODER2_MODEL = "Xenova/starcoder2-3b";

export async function encodeDecode() {
  const tokenizer = await AutoTokenizer.from_pretrained(LLAMA_MODEL);

  const text = "I am excited to show Tokenizers in action to my LLM engineers";
  const tokens = tokenizer.encode(text);
  console.log("Tokens:", tokens);
  console.log("Num characters:", text.length);
  console.log("Num tokens:", tokens.length); // ~1 token per 4 chars of English

  // decode turns token ids back into text.
  console.log("Decoded:", tokenizer.decode(tokens));

  // decode one id at a time to see where words were split.
  console.log(
    "Per-token:",
    tokens.map((id) => tokenizer.decode([id])),
  );
}

export async function chatTemplate() {
  // The instruct tokenizer knows how to format a chat into the model's exact prompt.
  const tokenizer = await AutoTokenizer.from_pretrained(LLAMA_MODEL);
  const messages = [
    { role: "system", content: "You are a helpful assistant" },
    { role: "user", content: "Tell a light-hearted joke for a room of Data Scientists" },
  ];
  const prompt = tokenizer.apply_chat_template(messages, {
    tokenize: false,
    add_generation_prompt: true,
  });
  console.log("Llama 3.1 chat prompt:\n", prompt);
}

export async function compareTokenizers() {
  // The same text tokenizes differently for each model.
  const text = "I am excited to show Tokenizers in action to my LLM engineers";
  for (const [name, id] of [
    ["Llama 3.1", LLAMA_MODEL],
    ["Phi-3", PHI3_MODEL],
    ["Qwen2", QWEN2_MODEL],
  ] as const) {
    const tokenizer = await AutoTokenizer.from_pretrained(id);
    console.log(`\n=== ${name} ===`);
    console.log("Tokens:", tokenizer.encode(text));
  }
}

export async function starcoder2Tokenizer() {
  // Starcoder2 is a code-focused tokenizer; it packs source more efficiently.
  const tokenizer = await AutoTokenizer.from_pretrained(STARCODER2_MODEL);
  const code = 'def hello_world(person):\n    print("Hello", person)\n';
  const tokens = tokenizer.encode(code);
  for (const id of tokens) {
    console.log(id, "=", JSON.stringify(tokenizer.decode([id])));
  }
}

async function main(): Promise<void> {
  await encodeDecode();
  await chatTemplate();
  await compareTokenizers();
  await starcoder2Tokenizer();
}

// Only run when invoked directly (so the file is safe to import for its helpers).
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
