import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { isMain } from "../src/is-main.js";
import { getModel } from "../src/model.js";

// State: graph_int stays empty until node1 fills it
const State = Annotation.Root({
  graph_int: Annotation<number>,
  graph_str: Annotation<string>,
});
type State = typeof State.State;

const modelLlm = getModel();

// nodes
/** take a state and ask our model to pick 1, 2 or 3 */
async function node1(state: State): Promise<Partial<State>> {
  const modelResponse = await modelLlm.invoke("choose between 1 or 3 or 2. reply only with a number");

  // Number("2") is 2, but Number("Two") is NaN: JavaScript does not throw here, so we check
  const number = Number(modelResponse.text.trim());
  return {
    graph_int: Number.isInteger(number) ? number : 0,
    graph_str: state.graph_str + "passed by node 1",
  };
}

/** keep the number and record that we passed by node 2 */
function node2(state: State): Partial<State> {
  return { graph_int: state.graph_int, graph_str: state.graph_str + "passed by node 2" };
}

/** keep the number and record that we passed by node 3 */
function node3(state: State): Partial<State> {
  return { graph_int: state.graph_int, graph_str: state.graph_str + "passed by node 3" };
}

// create edges
/** check state and return which node to go */
function nextStep(state: State): "node2" | "node3" | typeof END {
  const numberState = state.graph_int;
  if (numberState === 2) {
    return "node2";
  } else if (numberState === 3) {
    return "node3";
  } else {
    return END;
  }
}

// building graph
export const graph = new StateGraph(State)
  .addNode("node1", node1)
  .addNode("node2", node2)
  .addNode("node3", node3)
  .addEdge(START, "node1")
  .addConditionalEdges("node1", nextStep, ["node2", "node3", END])
  .addEdge("node2", END)
  .addEdge("node3", END)
  .compile();

if (isMain(import.meta.url)) {
  console.log(await graph.invoke({ graph_str: "" }));
}
