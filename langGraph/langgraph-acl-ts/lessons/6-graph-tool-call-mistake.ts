// The mistake from the video: addEdge with toolsCondition instead of addConditionalEdges.
// TypeScript catches it before running: addEdge wants a node name, not a routing function.
// `@ts-expect-error` keeps `pnpm typecheck` green so you can run the file and see the run-time error.
import { END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { tool } from "langchain";
import { z } from "zod";
import { getModel } from "../src/model.js";

const modelLlm = getModel();

const multiply = tool(({ nb1, nb2 }) => nb1 * nb2, {
  name: "multiply",
  description: "This tool is used for multiplying 2 numbers and returning the product",
  // z.coerce.number() also accepts "4" (some models, like llama3.2, send numbers as text)
  schema: z.object({ nb1: z.coerce.number(), nb2: z.coerce.number() }),
});

const modelLlmWithTool = modelLlm.bindTools([multiply]);

// nodes
async function chatWithTool(state: typeof MessagesAnnotation.State) {
  return { messages: [await modelLlmWithTool.invoke(state.messages)] };
}

const builder = new StateGraph(MessagesAnnotation)
  .addNode("chat_with_tool", chatWithTool)
  .addNode("tools", new ToolNode([multiply]));

builder.addEdge(START, "chat_with_tool");
// @ts-expect-error -- toolsCondition is a routing function, not a node name
builder.addEdge("chat_with_tool", toolsCondition);
builder.addEdge("tools", END);

// compile() checks the graph: nothing leads to "tools", so it stops here (no model call happens)
export const graph = builder.compile();
