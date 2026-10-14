import { HumanMessage, type BaseMessage } from "langchain";
import { isMain } from "../src/is-main.js";
import { show } from "../src/show.js";
// normal imports work in TypeScript even though the file names start with a digit
import { graph as conditional } from "./2-graph-conditional-edge.js";
import { graph as agent } from "./8-graph-agent.js";

if (isMain(import.meta.url)) {
  // 1. Draw a graph as Mermaid text (paste it into https://mermaid.live to see the picture)
  console.log((await conditional.getGraphAsync()).drawMermaid());

  // 2. Stream the updates: one chunk per node, as soon as that node finishes
  for await (const chunk of await conditional.stream({ graph_str: "hello I am new " }, { streamMode: "updates" })) {
    console.log("update:", chunk);
  }

  // 3. Stream the full state after every step
  for await (const state of await conditional.stream({ graph_str: "hi I am new " }, { streamMode: "values" })) {
    console.log("state:", state);
  }

  // 4. Watch the agent loop step by step: model -> tools -> model
  const question = { messages: [new HumanMessage("What is 12 multiplied by 7?")] };
  for await (const chunk of await agent.stream(question, { streamMode: "updates" })) {
    for (const [node, update] of Object.entries(chunk)) {
      const last = (update.messages as BaseMessage[]).at(-1)!; // each node returns { messages: [one new message] }
      console.log(`[${node}] ${show(last)}`);
    }
  }
}
