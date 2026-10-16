// Week 5 Day 3 — AutoGen Core (TypeScript version of 5_autogen/3_lab3_autogen_core.ipynb)
//
// AutoGen Core has no JavaScript version. src/core/runtime.ts is a small teaching runtime with the same shape
// (Message, RoutedAgent, @messageHandler, AgentId, SingleThreadedAgentRuntime); the "thinking" inside the agents
// is delegated to OpenAI Agents SDK agents, wrapped by src/core/assistant.ts to behave like AutoGen's AssistantAgent.
import { Agent } from "@openai/agents";
import { AssistantAgent } from "./core/assistant.js";
import { AgentId, messageHandler, RoutedAgent, SingleThreadedAgentRuntime, type MessageContext } from "./core/runtime.js";
import { MODEL, ollamaModel } from "./setup.js";

// ---------- The message: start by defining what agents send each other ----------
// Python: @dataclass class Message: content: str
class Message {
  constructor(public content: string) {}
}

// ---------- A simple agent with no LLM: "the disagreeable agent" ----------
class SimpleAgent extends RoutedAgent {
  constructor() {
    super("Simple");
  }

  @messageHandler(Message)
  async onMyMessage(message: Message, ctx: MessageContext): Promise<Message> {
    return new Message(`This is ${this.id.type}-${this.id.key}. You said '${message.content}' and I disagree.`);
  }
}

let runtime = new SingleThreadedAgentRuntime();
console.log(await SimpleAgent.register(runtime, "simple_agent", () => new SimpleAgent())); // declares a type; no agent yet
runtime.start();

const agentId = new AgentId("simple_agent", "default");
let response = await runtime.sendMessage<Message>(new Message("Well hi there!"), agentId); // the factory runs now
console.log(">>>", response.content);
await runtime.stop();
await runtime.close();

// ---------- An agent that delegates to an LLM agent ----------
class MyLLMAgent extends RoutedAgent {
  private delegate: AssistantAgent<string>;

  constructor() {
    super("LLMAgent");
    // Python: self._delegate = AssistantAgent("LLMAgent", model_client=OpenAIChatCompletionClient(model="gpt-4o-mini"))
    this.delegate = new AssistantAgent(new Agent({ name: "LLMAgent", model: MODEL, instructions: "You are a helpful AI assistant." }));
  }

  @messageHandler(Message)
  async handleMyMessageType(message: Message, ctx: MessageContext): Promise<Message> {
    console.log(`${this.id.type} received message: ${message.content}`);
    const reply = await this.delegate.reply(message.content, ctx.signal); // core Message -> text -> LLM -> text
    console.log(`${this.id.type} responded: ${reply}`);
    return new Message(reply);
  }
}

runtime = new SingleThreadedAgentRuntime();
await SimpleAgent.register(runtime, "simple_agent", () => new SimpleAgent());
console.log(await MyLLMAgent.register(runtime, "LLMAgent", () => new MyLLMAgent()));

runtime.start(); // start processing messages in the background
response = await runtime.sendMessage<Message>(new Message("Hi there!"), new AgentId("LLMAgent", "default"));
console.log(">>>", response.content);
response = await runtime.sendMessage<Message>(new Message(response.content), new AgentId("simple_agent", "default"));
console.log(">>>", response.content);
response = await runtime.sendMessage<Message>(new Message(response.content), new AgentId("LLMAgent", "default"));
await runtime.stop();
await runtime.close();

// ---------- Rock, paper, scissors: two players and a judge ----------
class Player1Agent extends RoutedAgent {
  private delegate: AssistantAgent<string>;

  constructor(name: string) {
    super(name);
    // Python: OpenAIChatCompletionClient(model="gpt-4o-mini", temperature=1.0)
    this.delegate = new AssistantAgent(new Agent({ name, model: MODEL, modelSettings: { temperature: 1.0 } }));
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
    // Can you spot the difference? Python: OllamaChatCompletionClient(model="llama3.2", temperature=1.0)
    this.delegate = new AssistantAgent(new Agent({ name, model: ollamaModel(), modelSettings: { temperature: 1.0 } }));
  }

  @messageHandler(Message)
  async handleMyMessageType(message: Message, ctx: MessageContext): Promise<Message> {
    return new Message(await this.delegate.reply(message.content, ctx.signal));
  }
}

const JUDGE = "You are judging a game of rock, paper, scissors. The players have made these choices:\n";

class RockPaperScissorsAgent extends RoutedAgent {
  private delegate: AssistantAgent<string>;

  constructor(name: string) {
    super(name);
    this.delegate = new AssistantAgent(new Agent({ name, model: MODEL, modelSettings: { temperature: 1.0 } }));
  }

  @messageHandler(Message)
  async handleMyMessageType(message: Message, ctx: MessageContext): Promise<Message> {
    const instruction = "You are playing rock, paper, scissors. Respond only with the one word, one of the following: rock, paper, or scissors.";
    message = new Message(instruction);
    const inner1 = new AgentId("player1", "default");
    const inner2 = new AgentId("player2", "default");
    const response1 = await this.sendMessage<Message>(message, inner1); // through the runtime, found by name
    const response2 = await this.sendMessage<Message>(message, inner2);
    const result = `Player 1: ${response1.content}\nPlayer 2: ${response2.content}\n`;
    const judgement = `${JUDGE}${result}Who wins?`;
    const verdict = await this.delegate.reply(judgement, ctx.signal);
    return new Message(result + verdict);
  }
}

runtime = new SingleThreadedAgentRuntime();
await Player1Agent.register(runtime, "player1", () => new Player1Agent("player1"));
await Player2Agent.register(runtime, "player2", () => new Player2Agent("player2"));
await RockPaperScissorsAgent.register(runtime, "rock_paper_scissors", () => new RockPaperScissorsAgent("rock_paper_scissors"));
runtime.start();

response = await runtime.sendMessage<Message>(new Message("go"), new AgentId("rock_paper_scissors", "default"));
console.log(response.content);
await runtime.stop();
await runtime.close();
