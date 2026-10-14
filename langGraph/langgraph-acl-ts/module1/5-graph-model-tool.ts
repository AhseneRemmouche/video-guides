import { END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { HumanMessage, tool } from "langchain";
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

// the graph ends right after the model: the tool call is requested but never run
export const graph = new StateGraph(MessagesAnnotation)
  .addNode("chat_with_tool", chatWithTool)
  .addEdge(START, "chat_with_tool")
  .addEdge("chat_with_tool", END)
  .compile();

if (isMain(import.meta.url)) {
  const result = await graph.invoke({ messages: [new HumanMessage("What is 4 multiplied by 5?")] });
  result.messages.forEach((message) => console.log(show(message)));
}
