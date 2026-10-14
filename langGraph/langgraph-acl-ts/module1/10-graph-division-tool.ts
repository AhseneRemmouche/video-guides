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

const multiply = tool(({ nb1, nb2 }) => nb1 * nb2, { name: "multiply", description: "Return the product of 2 numbers.", schema: numbers });
const addition = tool(({ nb1, nb2 }) => nb1 + nb2, { name: "addition", description: "Return the sum of 2 numbers.", schema: numbers });
const subtraction = tool(({ nb1, nb2 }) => nb1 - nb2, { name: "subtraction", description: "Return nb1 minus nb2.", schema: numbers });

const division = tool(
  ({ nb1, nb2 }) => {
    if (nb2 === 0) {
      // in JavaScript 5 / 0 is Infinity, not an error, so we throw one ourselves
      throw new Error("Cannot divide by zero. Ask the user for a different divisor.");
    }
    return nb1 / nb2;
  },
  { name: "division", description: "Return nb1 divided by nb2. nb2 must not be 0.", schema: numbers },
);

const tools = [multiply, addition, subtraction, division];
const modelLlmWithTools = modelLlm.bindTools(tools);

const systemMessage = new SystemMessage("You are a helpful math teacher. Use the tools for every calculation.");

async function chatWithTools(state: typeof MessagesAnnotation.State) {
  return { messages: [await modelLlmWithTools.invoke([systemMessage, ...state.messages])] };
}

/** Build the agent. handleToolErrors decides what happens when a tool throws. */
function buildGraph(handleToolErrors: boolean) {
  return new StateGraph(MessagesAnnotation)
    .addNode("chat_with_tools", chatWithTools)
    .addNode("tools", new ToolNode(tools, { handleToolErrors }))
    .addEdge(START, "chat_with_tools")
    .addConditionalEdges("chat_with_tools", toolsCondition, ["tools", END])
    .addEdge("tools", "chat_with_tools")
    .compile();
}

// true is already the LangGraph.js default (Python's default only catches bad arguments);
// we write it out so the choice is visible: the error becomes a ToolMessage the model can read
export const graph = buildGraph(true);

if (isMain(import.meta.url)) {
  const question = { messages: [new HumanMessage("Divide 5 by 0")] };

  console.log("1) handleToolErrors: true (the default)");
  const result = await graph.invoke(question);
  result.messages.forEach((message) => console.log("  ", show(message)));

  console.log("2) handleToolErrors: false");
  try {
    await buildGraph(false).invoke(question);
  } catch (error) {
    console.log("   the whole run crashed:", (error as Error).message);
  }
}
