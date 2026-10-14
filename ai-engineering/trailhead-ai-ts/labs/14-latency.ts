// Lab 14: measure time to first token, time per output token, and throughput with parallel requests.
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import * as config from "../src/config.js";
import { client } from "../src/llm.js";

const PROMPT: ChatCompletionMessageParam[] = [
  { role: "user", content: "In three sentences, how should I store an e-bike battery for the winter?" },
];
const now = () => performance.now() / 1000;

async function streamOnce() {
  const start = now();
  let first: number | undefined;
  let pieces = 0;
  const stream = await client.chat.completions.create({ model: config.MODEL, messages: PROMPT, stream: true, temperature: 0 });
  for await (const event of stream) {
    if (event.choices[0]?.delta.content) {
      first ??= now();
      pieces += 1;
    }
  }
  const end = now();
  first ??= end;
  return { ttft: first - start, tpot: (end - first) / Math.max(pieces - 1, 1), total: end - start, pieces };
}

console.log("1) Streaming one answer (3 runs)");
for (let i = 0; i < 3; i++) {
  const { ttft, tpot, total, pieces } = await streamOnce();
  console.log(`   TTFT ${ttft.toFixed(2).padStart(5)} s   TPOT ${Math.round(tpot * 1000).toString().padStart(4)} ms   ` +
    `total ${total.toFixed(2).padStart(5)} s   ${pieces} chunks`);
}

async function one(): Promise<number> {
  const r = await client.chat.completions.create({ model: config.MODEL, messages: PROMPT, temperature: 0 });
  return r.usage?.completion_tokens ?? 0;
}

async function burst(n: number) {
  const start = now();
  // Promise.all starts all n requests before waiting for any of them, like asyncio.gather in Python.
  const tokens = await Promise.all(Array.from({ length: n }, () => one()));
  const seconds = now() - start;
  return { seconds, tps: tokens.reduce((a, b) => a + b, 0) / seconds };
}

console.log("\n2) Throughput: the same request sent 1, 4 and 8 times at once");
for (const n of [1, 4, 8]) {
  const { seconds, tps } = await burst(n);
  console.log(`   ${n} at once: ${seconds.toFixed(1).padStart(5)} s wall time, ${tps.toFixed(1).padStart(5)} output tokens/s in total`);
}
