// Week 4 - Day 1: a first tiny StateGraph (LangGraph.js port of 1_lab1.py).
//
// LangGraph models an agent as a GRAPH. Four ideas:
//   * State  - a shared, typed object that flows through the graph.
//   * Node   - a function that reads the state and returns an update to it.
//   * Edge   - what runs next (START -> node -> END).
//   * compile+invoke - turn the builder into a runnable graph and call it.
//
// This graph is deliberately silly (like the course's lab 1): one node appends a
// random "<Noun> are <adjective>" message. The point is only to see the five steps.
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";

const nouns = ["Cabbages", "Unicorns", "Toasters", "Penguins", "Bananas", "Rainbows"];
const adjectives = ["outrageous", "smelly", "pedantic", "sparkly", "sarcastic", "haunted"];

const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

// Step 1 + 2: use the built-in MessagesAnnotation for the State. It defines a single
// `messages` channel whose reducer APPENDS new messages (the add_messages behaviour).
// Step 3: the node. It returns { messages: [...] }, which is appended to the state.
function firstNode(_state: typeof MessagesAnnotation.State) {
  const reply = `${pick(nouns)} are ${pick(adjectives)}`;
  return { messages: [new AIMessage(reply)] };
}

// Step 4 + 5: wire START -> first_node -> END, then compile into a runnable graph.
const graph = new StateGraph(MessagesAnnotation)
  .addNode("first_node", firstNode)
  .addEdge(START, "first_node")
  .addEdge("first_node", END)
  .compile();

// Run it from the command line: `npm run day1`.
async function main() {
  // Print the graph's shape as Mermaid text (the course draws it as a PNG).
  console.log(await graph.getGraphAsync().then((g) => g.drawMermaid()));

  const result = await graph.invoke({ messages: [] });
  // The last message is whatever the node appended.
  console.log("Reply:", result.messages.at(-1)?.content);
}

// Only run when executed directly (so the file can also be imported by tests/the API).
main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
