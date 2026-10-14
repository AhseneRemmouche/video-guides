import { END, MemorySaver, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage, tool } from "langchain";
import { z } from "zod";
import { isMain } from "../src/is-main.js";
import { getModel } from "../src/model.js";

const modelLlm = getModel();

// z.coerce.number() also accepts "4" (some models, like llama3.2, send numbers as text)
const numbers = z.object({ nb1: z.coerce.number(), nb2: z.coerce.number() });

const multiply = tool(({ nb1, nb2 }) => nb1 * nb2, {
  name: "multiply",
  description: "this tool return the multiplication of 2 numbers",
  schema: numbers,
});

const addition = tool(({ nb1, nb2 }) => nb1 + nb2, {
  name: "addition",
  description: "this tool return the sum of 2 numbers",
  schema: numbers,
});

const subtraction = tool(({ nb1, nb2 }) => nb1 - nb2, {
  name: "subtraction",
  description: "this tool return the subtraction of 2 numbers (nb1 - nb2)",
  schema: numbers,
});

const tools = [multiply, addition, subtraction];
const modelLlmWithTools = modelLlm.bindTools(tools);

const systemMessage = new SystemMessage("You are a helpful math teacher. Use the tools for every calculation.");

// nodes
async function chatWithTools(state: typeof MessagesAnnotation.State) {
  return { messages: [await modelLlmWithTools.invoke([systemMessage, ...state.messages])] };
}

const builder = new StateGraph(MessagesAnnotation)
  .addNode("chat_with_tools", chatWithTools)
  .addNode("tools", new ToolNode(tools))
  .addEdge(START, "chat_with_tools")
  .addConditionalEdges("chat_with_tools", toolsCondition, ["tools", END])
  .addEdge("tools", "chat_with_tools");

// the checkpointer saves the state after every step, one history per thread_id
export const memory = new MemorySaver();
export const graph = builder.compile({ checkpointer: memory });

if (isMain(import.meta.url)) { // run only with `pnpm graph 9`, not on import
  const config = { configurable: { thread_id: "1" } };

  let response = await graph.invoke({ messages: [new HumanMessage("Add 3 and 4.")] }, config);
  console.log(response.messages.at(-1)!.text);

  // same thread: the graph remembers the previous turn
  response = await graph.invoke({ messages: [new HumanMessage("Now multiply that by 10.")] }, config);
  console.log(response.messages.at(-1)!.text);

  // a different thread starts with an empty memory
  const other = { configurable: { thread_id: "2" } };
  response = await graph.invoke({ messages: [new HumanMessage("What was my last result?")] }, other);
  console.log(response.messages.at(-1)!.text);
}
