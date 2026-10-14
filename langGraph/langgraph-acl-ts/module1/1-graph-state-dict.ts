// importing the lib
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { isMain } from "../src/is-main.js";

// State: each field is a channel; the type of the whole state is State.State
const State = Annotation.Root({
  graph_str: Annotation<string>,
});
type State = typeof State.State;

// node
/** function takes a state object and returns an update with a greeting */
function greeting(state: State): Partial<State> {
  return { graph_str: state.graph_str + " welcome to AI Career Lab!" };
}

// edges

// putting our graph together
export const graph = new StateGraph(State)
  .addNode("greeting", greeting)
  .addEdge(START, "greeting")
  .addEdge("greeting", END)
  .compile();

if (isMain(import.meta.url)) {
  console.log(await graph.invoke({ graph_str: "hello" }));
}
