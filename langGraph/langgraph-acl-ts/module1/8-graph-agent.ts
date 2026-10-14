import { END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage, tool } from "langchain";
import { z } from "zod";
import { isMain } from "../src/is-main.js";
import { getModel } from "../src/model.js";
import { show } from "../src/show.js";

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
  // the system message goes first: it sets the role before the conversation starts
  return { messages: [await modelLlmWithTools.invoke([systemMessage, ...state.messages])] };
}

// the loop: after the tools run, go back to the model so it can read the results
export const builder = new StateGraph(MessagesAnnotation)
  .addNode("chat_with_tools", chatWithTools)
  .addNode("tools", new ToolNode(tools))
  .addEdge(START, "chat_with_tools")
  .addConditionalEdges("chat_with_tools", toolsCondition, ["tools", END])
  .addEdge("tools", "chat_with_tools");

export const graph = builder.compile();

if (isMain(import.meta.url)) {
  const result = await graph.invoke({ messages: [new HumanMessage("What is 12 multiplied by 7?")] });
  result.messages.forEach((message) => console.log(show(message)));
}
