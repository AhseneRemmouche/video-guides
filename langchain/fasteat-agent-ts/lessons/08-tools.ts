import "dotenv/config";
import { createAgent, HumanMessage, tool } from "langchain";
import { z } from "zod";
import { getModel } from "../src/models.js";

const printDocument = tool(
  ({ name }) => `this is the document of ${name}`,
  {
    name: "print_document",
    description: "use this tool to generate the propre document for your student",
    schema: z.object({ name: z.string() }),
  },
);

const agent = createAgent({
  model: getModel(),
  tools: [printDocument],
  systemPrompt: "YOU are an employee that use your tools for generating documents. DO Not say anything else",
});

const response = await agent.invoke({
  messages: [new HumanMessage("Hello I am a student and my name is Luca")],
});

console.log("this is the AI last response: ");
console.log(response.messages.at(-1)?.text);

console.log("--------------- this is the details -----------------");
console.log(response.messages);
