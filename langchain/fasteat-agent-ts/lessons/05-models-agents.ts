import "dotenv/config";
import { createAgent, HumanMessage, initChatModel } from "langchain";
import { MODEL_ID } from "../src/models.js";

// 0 to 1 from least creative to most creative
const model = await initChatModel(MODEL_ID, {
  temperature: 1.0,
});

const agent = createAgent({ model });

const response = await agent.invoke({
  messages: [new HumanMessage("what is the capital of italy?")],
});

console.log(response.messages.at(-1)?.text);
