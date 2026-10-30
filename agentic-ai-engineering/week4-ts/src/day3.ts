// Week 4 - Day 3: tools + conditional edges + memory (LangGraph.js port of 3_lab3.py).
//
// Three new ideas:
//   * bindTools      - tell the LLM which tools exist so it can ask to call one.
//   * ToolNode + toolsCondition - a prebuilt node that runs whatever tool the LLM
//     asked for, and a prebuilt router that sends the graph to "tools" when there is
//     a tool call, or to END when there is not.
//   * a checkpointer (MemorySaver) + a thread_id - so the graph REMEMBERS the
//     conversation between separate invoke() calls. Same thread_id = same memory.
//
// The course uses Playwright browser tools; here we use two safe local tools (a
// calculator and a fake price lookup) so the file needs no browser and no API key.
import { StateGraph, MessagesAnnotation, START, MemorySaver } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { makeLlm } from "./model.js";

// --- Tools -----------------------------------------------------------------
// tool() wraps a function with a name, description and a zod schema for its input.
// The description is how the model decides when to call the tool.
const calculator = tool(
  async ({ expression }) => {
    if (!/^[0-9+\-*/(). ]+$/.test(expression)) {
      return "Error: only numbers and + - * / ( ) are allowed.";
    }
    try {
      // Function(...) evaluates the arithmetic; the regex above restricts the input.
      const value = Function(`"use strict"; return (${expression});`)();
      return String(value);
    } catch (err) {
      return `Error: ${String(err)}`;
    }
  },
  {
    name: "calculator",
    description: "Evaluate a basic arithmetic expression, e.g. '23 * 19' or '(2+3)/4'.",
    schema: z.object({ expression: z.string().describe("the arithmetic to evaluate") }),
  },
);

const getPrice = tool(
  async ({ symbol }) => {
    const prices: Record<string, number> = { AAPL: 231.4, MSFT: 418.2, GOOG: 165.7, NVDA: 142.9 };
    const price = prices[symbol.toUpperCase()];
    return price === undefined
      ? `No price on file for ${symbol}. Known: ${Object.keys(prices).join(", ")}.`
      : `${symbol.toUpperCase()} is trading at $${price.toFixed(2)}.`;
  },
  {
    name: "get_price",
    description: "Return the current price for a stock ticker symbol (FAKE demo data).",
    schema: z.object({ symbol: z.string().describe("a ticker symbol like AAPL") }),
  },
);

const tools = [calculator, getPrice];

// The LLM, told about the tools so it can request them.
const llmWithTools = makeLlm().bindTools(tools);

async function chatbot(state: typeof MessagesAnnotation.State) {
  return { messages: [await llmWithTools.invoke(state.messages)] };
}

// Build the graph: chatbot <-> tools loop. toolsCondition routes chatbot -> tools when
// the last message has tool calls, otherwise chatbot -> END. After tools run, go back
// to the chatbot so it can use the results.
const graph = new StateGraph(MessagesAnnotation)
  .addNode("chatbot", chatbot)
  .addNode("tools", new ToolNode(tools))
  .addEdge(START, "chatbot")
  .addConditionalEdges("chatbot", toolsCondition)
  .addEdge("tools", "chatbot")
  // The checkpointer persists state per thread_id, so the graph remembers turns.
  .compile({ checkpointer: new MemorySaver() });

/** Send one message on a given conversation thread and return the reply text. */
export async function send(userInput: string, threadId: string): Promise<string> {
  const result = await graph.invoke(
    { messages: [{ role: "user", content: userInput }] },
    { configurable: { thread_id: threadId } },
  );
  return String(result.messages.at(-1)?.content ?? "");
}

async function main() {
  console.log(await graph.getGraphAsync().then((g) => g.drawMermaid()));

  const thread = "demo-thread-1";

  // Turn 1: give a fact AND ask for a tool.
  const q1 = "My name is Ada. Please use the calculator to compute 23 * 19.";
  console.log(`\n[thread=${thread}] User: ${q1}`);
  console.log(`Assistant: ${await send(q1, thread)}`);

  // Turn 2: SAME thread_id. If memory works, the model recalls the name from turn 1.
  const q2 = "What is my name, and what was the multiplication result you gave me?";
  console.log(`\n[thread=${thread}] User: ${q2}`);
  console.log(`Assistant: ${await send(q2, thread)}`);

  // Turn 3: a different thread has no memory of Ada - proves isolation.
  const q3 = "What is my name?";
  console.log(`\n[thread=demo-thread-2] User: ${q3}`);
  console.log(`Assistant: ${await send(q3, "demo-thread-2")}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
