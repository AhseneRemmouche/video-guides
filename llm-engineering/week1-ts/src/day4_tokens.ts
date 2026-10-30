// Day 4 - Seeing tokens with a tokenizer (TypeScript port of day4_tokens.py)
// The Python lab uses tiktoken's o200k_base encoding. gpt-tokenizer is the pure-JS
// equivalent: it ships the same o200k_base vocabulary and runs locally - no API key, no cost.
import { encode, decode } from "gpt-tokenizer/encoding/o200k_base";

const text = "Hi my name is Ed and I like banoffee pie";

// encode() -> the list of token ids the model sees
const tokens = encode(text);
console.log(tokens);
console.log(`${text.length} characters became ${tokens.length} tokens`);

// decode each id on its own to see where the word-pieces fall
for (const tokenId of tokens) {
  console.log(`${tokenId} = ${JSON.stringify(decode([tokenId]))}`);
}
