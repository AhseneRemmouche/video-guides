// Print a message on one line: its type, then its text, or the tool calls it asks for.
import { AIMessage, type BaseMessage } from "langchain";

export function show(message: BaseMessage) {
  const calls = AIMessage.isInstance(message) ? message.tool_calls ?? [] : [];
  const asked = calls.map((call) => `${call.name}(${JSON.stringify(call.args)})`).join(", ");
  return `${message.type}: ${message.text || asked}`;
}
