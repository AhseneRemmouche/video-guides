// A stand-in for AutoGen AgentChat's AssistantAgent, built on the OpenAI Agents SDK. Not a library class: it is these lines.
//
// The one behaviour that matters for the course: an AutoGen AssistantAgent REMEMBERS its conversation between
// on_messages() calls (that is why "OK proceed" works in Lab 2). The SDK's run() is stateless, so this wrapper keeps
// result.history and sends it back next time.
import { run, user, type Agent, type AgentInputItem } from "@openai/agents";

export class AssistantAgent<TOutput = any> {
  history: AgentInputItem[] = [];

  constructor(public readonly agent: Agent<any, any>, private readonly maxTurns = 10) {}

  /** Python: response = await agent.on_messages([message], cancellation_token). Returns the SDK's RunResult. */
  async onMessages(input: string | AgentInputItem[], signal?: AbortSignal) {
    const items = typeof input === "string" ? [user(input)] : input;
    const result = await run(this.agent, [...this.history, ...items], { maxTurns: this.maxTurns, signal });
    this.history = result.history; // remember everything, including tool calls and their results
    return result;
  }

  /** Shortcut for the common case: send text, get the final text (or structured object) back. */
  async reply(text: string, signal?: AbortSignal): Promise<TOutput> {
    const result = await this.onMessages(text, signal);
    return result.finalOutput as TOutput;
  }
}
