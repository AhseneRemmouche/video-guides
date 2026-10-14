import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { isMain } from "../src/is-main.js";

// state
const State = Annotation.Root({
  graph_str: Annotation<string>,
});
type State = typeof State.State;

// nodes
/** this node greet our user */
function node1(state: State): Partial<State> {
  return { graph_str: state.graph_str + "welcome to AI Carrer Lab" };
}

/** this node greet our user */
function node2(state: State): Partial<State> {
  return { graph_str: state.graph_str + "I am in Node 2" };
}

/** this node greet our user */
function node3(state: State): Partial<State> {
  return { graph_str: state.graph_str + "I am in Node 3" };
}

// edges
/** guide the state/graph to next node */
function nextStep(state: State): "node2" | "node3" {
  const arrayStateStr = state.graph_str.split(" ");

  if (arrayStateStr[0] === "hello") {
    return "node2";
  }

  return "node3";
}

// putting the graph together
export const graph = new StateGraph(State)
  .addNode("node1", node1)
  .addNode("node2", node2)
  .addNode("node3", node3)
  .addEdge(START, "node1")
  .addConditionalEdges("node1", nextStep, ["node2", "node3"])
  .addEdge("node2", END)
  .addEdge("node3", END)
  .compile();

if (isMain(import.meta.url)) {
  console.log(await graph.invoke({ graph_str: "hello I am new " }));
  console.log(await graph.invoke({ graph_str: "hi I am new " }));
  console.log(await graph.invoke({ graph_str: "Hello I am new " })); // capital H: the check is case-sensitive
}
