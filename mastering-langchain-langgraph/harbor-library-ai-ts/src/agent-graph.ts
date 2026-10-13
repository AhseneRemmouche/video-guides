// The library agent as a LangGraph graph (the loop from lab 09), reused by labs 11-13 and the web app.
import { SystemMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { READ_TOOLS } from "./catalog.js";
import { getModel } from "./config.js";

export const SYSTEM = new SystemMessage(
  "You are Harbor City Library's assistant. Use the tools to look things up. " +
    "Remember what the visitor told you earlier in the conversation. Answer briefly.",
);

export function buildBuilder(tools: StructuredToolInterface[] = READ_TOOLS) {
  const model = getModel().bindTools(tools);

  async function callModel(state: typeof MessagesAnnotation.State) {
    return { messages: [await model.invoke([SYSTEM, ...state.messages])] };
  }

  return new StateGraph(MessagesAnnotation)
    .addNode("model", callModel)
    .addNode("tools", new ToolNode(tools))
    .addEdge(START, "model")
    .addConditionalEdges("model", toolsCondition)
    .addEdge("tools", "model");
}
