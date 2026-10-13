// Lab 09: tools. First by hand, then with LangGraph's ToolNode in a loop.
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { toJSONSchema } from "zod";
import { READ_TOOLS, checkAvailability } from "../src/catalog.js";
import { getModel } from "../src/config.js";
import { printRun } from "../src/show.js";

// 1. A tool is a function plus a name, a description and an argument schema the model reads.
console.log("1) What the model sees for check_availability:");
console.log("  ", checkAvailability.name, "|", checkAvailability.description);
console.log("  ", JSON.stringify(toJSONSchema(checkAvailability.schema).properties));

// 2. bindTools: the model can now answer with tool calls instead of text. It does not run them.
const model = getModel().bindTools(READ_TOOLS);
const reply = await model.invoke("Is The Quiet Engine on the shelf? Its id is B004.");
console.log("\n2) The model asked for:", reply.tool_calls);

// 3. We run the tool ourselves and could send the result back. ToolNode automates exactly this.
for (const call of reply.tool_calls ?? []) {
  console.log("   running it gives:", await checkAvailability.invoke(call.args as { item_id: string }));
}

// 4. The agent loop as a graph: model -> (tools -> model)* -> end.
const SYSTEM = new SystemMessage("You are Harbor City Library's assistant. Use the tools to look things up. Answer briefly.");

async function callModel(state: typeof MessagesAnnotation.State) {
  return { messages: [await model.invoke([SYSTEM, ...state.messages])] };
}

const agent = new StateGraph(MessagesAnnotation)
  .addNode("model", callModel)
  .addNode("tools", new ToolNode(READ_TOOLS))
  .addEdge(START, "model")
  .addConditionalEdges("model", toolsCondition) // goes to "tools" if there are tool calls, else ends
  .addEdge("tools", "model")
  .compile();

for (const question of ["Do you have any books by Mara Quint? Is one available?", "What are member M-1001's loans and fees?"]) {
  console.log(`\n4) Q: ${question}`);
  const result = await agent.invoke({ messages: [new HumanMessage(question)] });
  printRun(result.messages.slice(1));
}
