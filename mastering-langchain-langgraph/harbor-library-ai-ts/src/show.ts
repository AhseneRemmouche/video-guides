// Print what happened in an agent run: tool calls, tool results and the answer.
import { isAIMessage, isToolMessage, type BaseMessage } from "@langchain/core/messages";

export function toolCalls(messages: BaseMessage[]): [string, unknown][] {
  return messages.flatMap((m) => (isAIMessage(m) ? (m.tool_calls ?? []).map((c): [string, unknown] => [c.name, c.args]) : []));
}

export function printRun(messages: BaseMessage[], indent = "   ") {
  for (const m of messages) {
    if (isAIMessage(m) && m.tool_calls?.length) {
      console.log(`${indent}model -> tools:`, JSON.stringify(toolCalls([m])));
    } else if (isToolMessage(m)) {
      console.log(`${indent}tool ${m.name} -> ${JSON.stringify(String(m.content).slice(0, 100))}`);
    } else {
      console.log(`${indent}answer:`, m.content);
    }
  }
}
