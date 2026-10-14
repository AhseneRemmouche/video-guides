import "dotenv/config";
import { createAgent, HumanMessage } from "langchain";
import { getModel } from "../src/models.js";

const agent = createAgent({ model: getModel() });

let response = await agent.invoke({
  messages: [new HumanMessage("My favorite color is green")],
});

console.log(response.messages.at(-1)?.text);

response = await agent.invoke({
  messages: [new HumanMessage("what is my favorite color")],
});

console.log(response.messages.at(-1)?.text);
