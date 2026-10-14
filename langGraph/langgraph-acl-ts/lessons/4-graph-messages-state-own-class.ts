// What MessagesAnnotation looks like inside: one "messages" channel whose reducer
// (addMessages) appends new messages instead of replacing the list.
import { Annotation, END, START, StateGraph, addMessages } from "@langchain/langgraph";
import { HumanMessage, type BaseMessage } from "langchain";
import { isMain } from "../src/is-main.js";
import { getModel } from "../src/model.js";
import { show } from "../src/show.js";

// state: our own version of MessagesAnnotation
const MessagesState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: addMessages,
    default: () => [],
  }),
});

const modelLlm = getModel();

// nodes
async function chat(state: typeof MessagesState.State) {
  return { messages: [await modelLlm.invoke(state.messages)] };
}

// create our graph
export const graph = new StateGraph(MessagesState)
  .addNode("chat", chat)
  .addEdge(START, "chat")
  .addEdge("chat", END)
  .compile();

if (isMain(import.meta.url)) {
  const result = await graph.invoke({ messages: [new HumanMessage("Why is the sky blue? Answer in one sentence.")] });
  result.messages.forEach((message) => console.log(show(message)));
}
