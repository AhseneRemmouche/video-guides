// Week 4 - Day 2: a chatbot as a StateGraph (LangGraph.js port of 2_lab2.py).
//
// Same five steps as day 1, but now the single node calls a real LLM. The State's
// `messages` channel uses the add_messages reducer (via MessagesAnnotation), so each
// turn is appended to the running conversation that the node sees.
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { makeLlm } from "./model.js";

// The model that powers the one node (pointed at Ollama by model.ts).
const llm = makeLlm();

// Step 3: the chatbot node. It asks the LLM using every message so far and returns
// the reply; the reducer appends it to state.messages.
async function chatbot(state: typeof MessagesAnnotation.State) {
  const response = await llm.invoke(state.messages);
  return { messages: [response] };
}

// Steps 1,2,4,5: State (MessagesAnnotation) -> add node -> wire edges -> compile.
const graph = new StateGraph(MessagesAnnotation)
  .addNode("chatbot", chatbot)
  .addEdge(START, "chatbot")
  .addEdge("chatbot", END)
  .compile();

/** Send one user message through the graph and return the assistant's reply text. */
export async function chatOnce(userInput: string): Promise<string> {
  const result = await graph.invoke({
    messages: [{ role: "user", content: userInput }],
  });
  return String(result.messages.at(-1)?.content ?? "");
}

async function main() {
  console.log(await graph.getGraphAsync().then((g) => g.drawMermaid()));

  // This graph has no checkpointer, so each call is independent - no memory between
  // turns. Memory is added in day 3.
  for (const prompt of [
    "In one sentence, what is LangGraph?",
    "Name one benefit of modelling an agent as a graph. One sentence.",
  ]) {
    console.log(`\nUser: ${prompt}`);
    console.log(`Assistant: ${await chatOnce(prompt)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
