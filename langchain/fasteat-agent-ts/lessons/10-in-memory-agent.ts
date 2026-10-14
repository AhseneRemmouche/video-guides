import "dotenv/config";
import { MemorySaver } from "@langchain/langgraph";
import { createAgent, HumanMessage } from "langchain";
import { getModel } from "../src/models.js";

const agent = createAgent({
  model: getModel(),
  checkpointer: new MemorySaver(),
});

const config = { configurable: { thread_id: "1" } };

let response = await agent.invoke(
  { messages: [new HumanMessage("My favorite color is green")] },
  config,
);

console.log(response.messages.at(-1)?.text);

response = await agent.invoke(
  { messages: [new HumanMessage("what is my favorite color")] },
  config,
);

console.log(response.messages.at(-1)?.text);
