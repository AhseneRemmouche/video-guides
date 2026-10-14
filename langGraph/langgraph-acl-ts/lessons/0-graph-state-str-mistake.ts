// The mistake from the video: passing the function `greeting` to addEdge instead of the node name "greeting".
// TypeScript catches it before running: addEdge only accepts the names of nodes you added.
// The `@ts-expect-error` lines tell the type checker "yes, this line is wrong on purpose",
// so `pnpm typecheck` still passes and you can run the file to see what happens at run time.
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

// State
const State = Annotation.Root({
  text: Annotation<string>,
});

// nodes
/** this function greets people to ACL */
function greeting(state: typeof State.State) {
  return { text: state.text + "welcome to AI Career Lab!" };
}

// langGraph putting our graph together
const builder = new StateGraph(State).addNode("greeting", greeting);

// add edges
// @ts-expect-error -- a function is not a node name (accepted at run time, silently)
builder.addEdge(START, greeting);
// @ts-expect-error -- a function is not a node name (this one crashes at run time)
builder.addEdge(greeting, END);

const graph = builder.compile();

console.log(await graph.invoke({ text: "hey am new!" }));
