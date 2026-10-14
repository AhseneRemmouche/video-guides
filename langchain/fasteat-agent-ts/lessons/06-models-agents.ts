import "dotenv/config";
import { AIMessage, createAgent, HumanMessage } from "langchain";
import { MODEL_ID } from "../src/models.js";

// The model can be a plain string: "gpt-5-nano" (OpenAI) or "ollama:llama3.2".
const agent = createAgent({ model: MODEL_ID });

const response = await agent.invoke({
  messages: [
    new HumanMessage("what is the capital of italy?"),
    new AIMessage("Rome (Italian: Roma)."),
    new HumanMessage("tell me more about it"),
  ],
});

console.log(response.messages.at(-1)?.text);
