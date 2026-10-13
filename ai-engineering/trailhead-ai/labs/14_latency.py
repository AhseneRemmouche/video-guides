"""Lab 14: measure time to first token, time per output token, and throughput with parallel requests."""
import asyncio
import time

from openai import AsyncOpenAI

from aie import config
from aie.llm import client

PROMPT = [{"role": "user", "content": "In three sentences, how should I store an e-bike battery for the winter?"}]


def stream_once():
    start = time.perf_counter()
    first, pieces = None, 0
    stream = client.chat.completions.create(model=config.MODEL, messages=PROMPT, stream=True, temperature=0)
    for event in stream:
        if event.choices and event.choices[0].delta.content:
            first = first or time.perf_counter()
            pieces += 1
    end = time.perf_counter()
    return first - start, (end - first) / max(pieces - 1, 1), end - start, pieces


print("1) Streaming one answer (3 runs)")
for _ in range(3):
    ttft, tpot, total, pieces = stream_once()
    print(f"   TTFT {ttft:5.2f} s   TPOT {tpot * 1000:4.0f} ms   total {total:5.2f} s   {pieces} chunks")

aclient = AsyncOpenAI(base_url=config.BASE_URL, api_key=config.API_KEY)


async def one():
    r = await aclient.chat.completions.create(model=config.MODEL, messages=PROMPT, temperature=0)
    return r.usage.completion_tokens


async def burst(n):
    start = time.perf_counter()
    tokens = await asyncio.gather(*(one() for _ in range(n)))
    seconds = time.perf_counter() - start
    return seconds, sum(tokens) / seconds


async def main():
    # One event loop for all bursts: the async client must not outlive the loop it was used in.
    for n in (1, 4, 8):
        seconds, tps = await burst(n)
        print(f"   {n} at once: {seconds:5.1f} s wall time, {tps:5.1f} output tokens/s in total")


print("\n2) Throughput: the same request sent 1, 4 and 8 times at once")
asyncio.run(main())
