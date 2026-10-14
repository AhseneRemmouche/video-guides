// A chat model that needs no API key: it answers with a fixed text, or asks for a tool when tools are bound.
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";

export type FakeOptions = {
  reply?: string; // the text answer
  toolCall?: { name: string; args: Record<string, unknown> }; // the tool call to ask for
};

// "What is 12 multiplied by 7?" -> multiply(12, 7): used when no toolCall is given
const KEYWORDS: [RegExp, string][] = [
  [/multipl|times|product/i, "multiply"],
  [/add|plus|sum/i, "addition"],
  [/subtract|minus/i, "subtraction"],
  [/divide/i, "division"],
];

function guessToolCall(text: string, toolNames: string[]) {
  const numbers = text.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const name = KEYWORDS.find(([pattern, tool]) => pattern.test(text) && toolNames.includes(tool))?.[1];
  return name && numbers.length >= 2 ? { name, args: { nb1: numbers[0], nb2: numbers[1] } } : undefined;
}

export class FakeChatModel extends BaseChatModel {
  constructor(private options: FakeOptions = {}, private toolNames: string[] = []) {
    super({});
  }

  _llmType() {
    return "fake";
  }

  // bindTools returns a copy that knows which tools it may ask for
  override bindTools(tools: { name?: string }[]) {
    return new FakeChatModel(this.options, tools.map((t) => t.name ?? ""));
  }

  async _generate(messages: BaseMessage[]): Promise<ChatResult> {
    const conversation = messages.filter((m) => m.type !== "system");
    const last = conversation.at(-1)!;
    const toolCall = this.options.toolCall ?? guessToolCall(last.text, this.toolNames);
    let message: AIMessage;
    if (toolCall && this.toolNames.length > 0 && !ToolMessage.isInstance(last)) {
      message = new AIMessage({ content: "", tool_calls: [{ ...toolCall, id: `call_${messages.length}` }] });
    } else if (ToolMessage.isInstance(last)) {
      message = new AIMessage(`The result is ${last.text}`);
    } else {
      message = new AIMessage(this.options.reply ?? "fake answer");
    }
    return { generations: [{ message, text: message.text }] };
  }
}
