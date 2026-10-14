// Graph 6 without the prebuilt helpers: our own tool node and our own routing function.
import { END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { AIMessage, HumanMessage, ToolMessage, tool } from "langchain";
import { z } from "zod";
import { isMain } from "../src/is-main.js";
import { getModel } from "../src/model.js";
import { show } from "../src/show.js";

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

// what ToolNode does for us, written by hand
async function toolNode(state: typeof MessagesAnnotation.State) {
  const lastMessage = state.messages.at(-1) as AIMessage;
  const toolCall = lastMessage.tool_calls![0];
  const response = await multiply.invoke(toolCall.args as { nb1: number; nb2: number });

  return { messages: [new ToolMessage({ content: String(response), tool_call_id: toolCall.id! })] };
}

// what toolsCondition does for us, written by hand
function shouldContinue(state: typeof MessagesAnnotation.State): "tool_node" | typeof END {
  const lastMessage = state.messages.at(-1) as AIMessage;

  // Did the LLM request a tool?
  if (lastMessage.tool_calls?.length) {
    return "tool_node";
  }

  return END;
}

export const graph = new StateGraph(MessagesAnnotation)
  .addNode("chat_with_tool", chatWithTool)
  .addNode("tool_node", toolNode)
  .addEdge(START, "chat_with_tool")
  .addConditionalEdges("chat_with_tool", shouldContinue, ["tool_node", END])
  .addEdge("tool_node", END)
  .compile();

if (isMain(import.meta.url)) {
  const result = await graph.invoke({ messages: [new HumanMessage("What is 4 multiplied by 5?")] });
  result.messages.forEach((message) => console.log(show(message)));
}
