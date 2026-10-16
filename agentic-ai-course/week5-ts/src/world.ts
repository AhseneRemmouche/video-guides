// Week 5 Day 5 — launch the world (TypeScript version of 5_autogen/world.py). This is a plain script, not an agent.
//
// It starts the host and one worker (src/core/distributed.ts, a teaching stand-in for AutoGen's gRPC runtime),
// registers the Creator, then asks it to create HOW_MANY_AGENTS agents AT THE SAME TIME and saves each idea to ideaN.md.
//
// SAFETY: every creation writes LLM-generated TypeScript to src/agentN.ts and runs it. See the warning in creator.ts.
// COST: the course runs 20 with gpt-4o-mini ("a couple of cents"). The default here is 3; HOW_MANY_AGENTS=20 pnpm world for more.
import { writeFileSync } from "node:fs";
import { WorkerAgentRuntime, WorkerAgentRuntimeHost } from "./core/distributed.js";
import { AgentId } from "./core/runtime.js";
import { Creator } from "./creator.js";
import * as messages from "./messages.js";

const HOW_MANY_AGENTS = Number(process.env.HOW_MANY_AGENTS ?? 3);

async function createAndMessage(worker: WorkerAgentRuntime, creatorId: AgentId, i: number) {
  try {
    const result = await worker.sendMessage<messages.Message>(new messages.Message(`agent${i}.ts`), creatorId);
    writeFileSync(`idea${i}.md`, result.content, "utf-8");
  } catch (e) {
    console.log(`Failed to run worker ${i} due to exception: ${e}`); // one bad generated file must not stop the others
  }
}

async function main() {
  const host = new WorkerAgentRuntimeHost("localhost:50051");
  await host.start();
  const worker = new WorkerAgentRuntime("localhost:50051");
  await worker.start();
  await Creator.register(worker, "Creator", () => new Creator("Creator"));
  const creatorId = new AgentId("Creator", "default");
  // Python: coroutines = [...]; await asyncio.gather(*coroutines). In JavaScript calling an async function already
  // starts it, so build the array of promises and wait for all of them with Promise.all.
  const promises = [];
  for (let i = 1; i <= HOW_MANY_AGENTS; i++) promises.push(createAndMessage(worker, creatorId, i));
  await Promise.all(promises);
  try {
    await worker.stop();
    await host.stop();
  } catch (e) {
    console.log(e);
  }
}

// Python needs asyncio.run(main()) to start an event loop; Node always has one running.
await main();
