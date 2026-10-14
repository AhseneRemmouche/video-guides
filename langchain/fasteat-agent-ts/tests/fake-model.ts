// A pretend chat model for offline tests: it answers from a script and remembers what it was sent.
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, AIMessageChunk, type BaseMessage } from "@langchain/core/messages";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";

export type Reply = (messages: BaseMessage[], call: number) => AIMessage;

export class ScriptedChatModel extends BaseChatModel {
  calls: BaseMessage[][] = [];
  boundTools: unknown[] = [];
  boundOptions: Record<string, unknown> = {};
  private reply: Reply;

  constructor(reply: Reply | AIMessage[], private structuredOutput = false) {
    super({});
    this.reply = Array.isArray(reply) ? (_messages, call) => reply[Math.min(call, reply.length - 1)] : reply;
  }

  _llmType() {
    return "scripted";
  }

  // createAgent reads this to choose providerStrategy (true) or toolStrategy (false) for structured output.
  get profile() {
    return { structuredOutput: this.structuredOutput };
  }

  // Keep the same instance, so the test can read `calls` afterwards.
  bindTools(tools: unknown[], options: Record<string, unknown> = {}) {
    this.boundTools = tools;
    this.boundOptions = options;
    return this;
  }

  private next(messages: BaseMessage[]) {
    this.calls.push(messages);
    return this.reply(messages, this.calls.length - 1);
  }

  async _generate(messages: BaseMessage[]): Promise<ChatResult> {
    const message = this.next(messages);
    return { generations: [{ text: message.text, message }] };
  }

  // Used when someone streams (agent.stream with streamMode "messages"): one chunk per word.
  async *_streamResponseChunks(messages: BaseMessage[], _options: this["ParsedCallOptions"], runManager?: CallbackManagerForLLMRun) {
    const message = this.next(messages);
    const chunks = message.tool_calls?.length
      ? [new AIMessageChunk({
          content: "",
          tool_call_chunks: message.tool_calls.map((call, index) => ({
            type: "tool_call_chunk" as const, name: call.name, args: JSON.stringify(call.args), id: call.id, index,
          })),
        })]
      : message.text.split(/(?<= )/).map((word) => new AIMessageChunk({ content: word }));
    for (const messageChunk of chunks) {
      const chunk = new ChatGenerationChunk({ text: messageChunk.text, message: messageChunk });
      yield chunk;
      await runManager?.handleLLMNewToken(chunk.text, undefined, undefined, undefined, undefined, { chunk });
    }
  }
}

/** An AI message that asks for one tool call. */
export function callTool(name: string, args: Record<string, unknown>, id = `call_${name}`) {
  return new AIMessage({ content: "", tool_calls: [{ id, name, args, type: "tool_call" }] });
}
