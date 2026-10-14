import { END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { HumanMessage } from "langchain";
import { isMain } from "../src/is-main.js";
import { getModel } from "../src/model.js";
import { show } from "../src/show.js";

const modelLlm = getModel();

// nodes
async function chat(state: typeof MessagesAnnotation.State) {
  return { messages: [await modelLlm.invoke(state.messages)] };
}

// create our graph
export const graph = new StateGraph(MessagesAnnotation)
  .addNode("chat", chat)
  .addEdge(START, "chat")
  .addEdge("chat", END)
  .compile();

if (isMain(import.meta.url)) {
  const result = await graph.invoke({ messages: [new HumanMessage("Why is the sky blue? Answer in one sentence.")] });
  result.messages.forEach((message) => console.log(show(message)));
}
