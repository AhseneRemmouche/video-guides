// Week 5 Day 4 — AutoGen Core distributed (TypeScript version of 5_autogen/4_lab4_autogen_distributed.ipynb)
//
// Python starts a GrpcWorkerAgentRuntimeHost on localhost:50051 and one or three GrpcWorkerAgentRuntime workers.
// AutoGen has no JavaScript version; src/core/distributed.ts is a teaching stand-in (HTTP + JSON instead of gRPC).
// One real difference: in the notebook every worker lives in the same Python kernel. Here, with ALL_IN_ONE_WORKER=false,
// player1 and player2 run in two child processes, so the messages really cross process boundaries.
//
//   pnpm lab4                          three workers (the repo default, ALL_IN_ONE_WORKER = False)
//   ALL_IN_ONE_WORKER=true pnpm lab4   one worker with all three agents
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Agent } from "@openai/agents";
import { AssistantAgent } from "./core/assistant.js";
import { WorkerAgentRuntime, WorkerAgentRuntimeHost } from "./core/distributed.js";
import { AgentId, messageHandler, RoutedAgent, type MessageContext } from "./core/runtime.js";
import { MODEL } from "./setup.js";
import { searchTool } from "./tools.js";

const ALL_IN_ONE_WORKER = process.env.ALL_IN_ONE_WORKER === "true";
const HOST_ADDRESS = "localhost:50051";

class Message {
  constructor(public content: string) {}
}

const instruction1 =
  "To help with a decision on whether to use AutoGen in a new AI Agent project, " +
  "please research and briefly respond with reasons in favor of choosing AutoGen; the pros of AutoGen.";
const instruction2 =
  "To help with a decision on whether to use AutoGen in a new AI Agent project, " +
  "please research and briefly respond with reasons against choosing AutoGen; the cons of Autogen.";
const judge =
  "You must make a decision on whether to use AutoGen for a project. " +
  "Your research team has come up with the following reasons for and against. " +
  "Based purely on the research from your team, please respond with your decision and brief rationale.";

// ---------- The agents: exactly the same style as Lab 3. Nothing here knows it is distributed. ----------
class Player1Agent extends RoutedAgent {
  private delegate: AssistantAgent<string>;
  constructor(name: string) {
    super(name);
    this.delegate = new AssistantAgent(new Agent({ name, model: MODEL, tools: [searchTool] }));
  }
  @messageHandler(Message)
  async handleMyMessageType(message: Message, ctx: MessageContext): Promise<Message> {
    return new Message(await this.delegate.reply(message.content, ctx.signal));
  }
}

class Player2Agent extends RoutedAgent {
  private delegate: AssistantAgent<string>;
  constructor(name: string) {
    super(name);
    this.delegate = new AssistantAgent(new Agent({ name, model: MODEL, tools: [searchTool] })); // swap in another model here
  }
  @messageHandler(Message)
  async handleMyMessageType(message: Message, ctx: MessageContext): Promise<Message> {
    return new Message(await this.delegate.reply(message.content, ctx.signal));
  }
}

class Judge extends RoutedAgent {
  private delegate: AssistantAgent<string>;
  constructor(name: string) {
    super(name);
    this.delegate = new AssistantAgent(new Agent({ name, model: MODEL }));
  }
  @messageHandler(Message)
  async handleMyMessageType(message: Message, ctx: MessageContext): Promise<Message> {
    const message1 = new Message(instruction1);
    const message2 = new Message(instruction2);
    const inner1 = new AgentId("player1", "default");
    const inner2 = new AgentId("player2", "default");
    const response1 = await this.sendMessage<Message>(message1, inner1);
    const response2 = await this.sendMessage<Message>(message2, inner2);
    const result = `## Pros of AutoGen:\n${response1.content}\n\n## Cons of AutoGen:\n${response2.content}\n\n`;
    const judgement = `${judge}\n${result}Respond with your decision and brief explanation`;
    const decision = await this.delegate.reply(judgement, ctx.signal);
    return new Message(result + "\n\n## Decision:\n\n" + decision);
  }
}

const agentClasses = { player1: Player1Agent, player2: Player2Agent } as const;

// ---------- Child-process mode: "pnpm lab4 --worker player1" starts one worker holding one agent ----------
const workerFlag = process.argv.indexOf("--worker");
if (workerFlag !== -1) {
  const type = process.argv[workerFlag + 1] as keyof typeof agentClasses;
  const worker = new WorkerAgentRuntime(HOST_ADDRESS);
  await worker.start();
  await agentClasses[type].register(worker, type, () => new agentClasses[type](type));
  console.log(`[worker ${process.pid}] serving ${type}`);
  process.on("SIGTERM", () => worker.stop().then(() => process.exit(0)));
} else {
  // ---------- Main mode ----------
  const host = new WorkerAgentRuntimeHost(HOST_ADDRESS);
  await host.start(); // Python's host.start() is not awaited; awaiting here just guarantees the port is open
  const children: ChildProcess[] = [];

  const worker = new WorkerAgentRuntime(HOST_ADDRESS);
  await worker.start(); // a worker's start IS awaited, as in Python
  if (ALL_IN_ONE_WORKER) {
    await Player1Agent.register(worker, "player1", () => new Player1Agent("player1"));
    await Player2Agent.register(worker, "player2", () => new Player2Agent("player2"));
    await Judge.register(worker, "judge", () => new Judge("judge"));
  } else {
    // worker1 and worker2 become separate processes running this same file with --worker
    for (const type of ["player1", "player2"]) {
      const args = [...process.execArgv, fileURLToPath(import.meta.url), "--worker", type];
      children.push(spawn(process.execPath, args, { stdio: "inherit", env: process.env }));
    }
    await host.waitFor(["player1", "player2"]);
    await Judge.register(worker, "judge", () => new Judge("judge"));
  }
  const agentId = new AgentId("judge", "default");

  try {
    const started = Date.now();
    const response = await worker.sendMessage<Message>(new Message("Go!"), agentId);
    console.log(response.content);
    console.log(`\n(${((Date.now() - started) / 1000).toFixed(1)} s, ${ALL_IN_ONE_WORKER ? "one worker" : "three workers, two of them child processes"})`);
  } catch (e) {
    console.error("Run failed:", e);
    process.exitCode = 1;
  } finally {
    await worker.stop();
    for (const child of children) child.kill("SIGTERM");
    await host.stop();
  }
}
