// Lab 08: the RAG chain rebuilt as a LangGraph graph with a router.
import type { Document } from "@langchain/core/documents";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { getModel } from "../src/config.js";
import { buildVectorStore, formatDocs } from "../src/knowledge.js";

const retriever = (await buildVectorStore()).asRetriever({ k: 2 });
const model = getModel();

// The state: each key is a channel that nodes read and update.
const State = Annotation.Root({
  question: Annotation<string>,
  route: Annotation<string>,
  docs: Annotation<Document[]>,
  answer: Annotation<string>,
});
type State = typeof State.State;

const Route = z.object({ route: z.enum(["library", "other"]) });

async function classify(state: State): Promise<Partial<State>> {
  const prompt = "Is this question about a public library (cards, loans, fees, branches, rooms, digital services)? " +
    `Answer 'library' or 'other'.\nQuestion: ${state.question}`;
  return { route: (await model.withStructuredOutput(Route, { name: "Route" }).invoke(prompt)).route };
}

async function retrieve(state: State): Promise<Partial<State>> {
  return { docs: await retriever.invoke(state.question) };
}

async function generate(state: State): Promise<Partial<State>> {
  const prompt = "Answer in one or two sentences using only this context. If it is not there, say you don't know.\n\n" +
    `${formatDocs(state.docs)}\n\nQuestion: ${state.question}`;
  return { answer: String((await model.invoke(prompt)).content) };
}

function decline(): Partial<State> {
  return { answer: "I can only help with Harbor City Library questions." };
}

function pickNext(state: State) {
  return state.route === "library" ? "retrieve" : "decline";
}

const graph = new StateGraph(State)
  .addNode("classify", classify)
  .addNode("retrieve", retrieve)
  .addNode("generate", generate)
  .addNode("decline", decline)
  .addEdge(START, "classify")
  .addConditionalEdges("classify", pickNext, ["retrieve", "decline"])
  .addEdge("retrieve", "generate")
  .addEdge("generate", END)
  .addEdge("decline", END)
  .compile();

console.log("1) The graph as Mermaid text (paste it into mermaid.live to see it):");
console.log((await graph.getGraphAsync()).drawMermaid());

console.log("2) Running it. streamMode 'updates' shows each node as it finishes:");
for (const question of ["How many items can a junior card borrow?", "Who won the football match yesterday?"]) {
  console.log(`\n   Q: ${question}`);
  for await (const update of await graph.stream({ question }, { streamMode: "updates" })) {
    for (const [node, change] of Object.entries(update)) {
      const shown = Object.fromEntries(Object.entries(change ?? {}).map(([k, v]) =>
        [k, k === "docs" ? `${(v as Document[]).length} documents` : v]));
      console.log(`   [${node}]`, shown);
    }
  }
}
