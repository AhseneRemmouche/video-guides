// importing our lib
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { isMain } from "../src/is-main.js";

// State: LangGraph.js states are always objects, so the string lives in one field
const State = Annotation.Root({
  text: Annotation<string>,
});

// nodes
/** this function greets people to ACL */
function greeting(state: typeof State.State) {
  return { text: state.text + "welcome to AI Career Lab!" };
}

// edges

// langGraph putting our graph together
export const graph = new StateGraph(State)
  // add nodes to our graph
  .addNode("greeting", greeting)
  // add edges
  .addEdge(START, "greeting")
  .addEdge("greeting", END)
  .compile();

if (isMain(import.meta.url)) {
  console.log(await graph.invoke({ text: "hey am new!" }));
}
