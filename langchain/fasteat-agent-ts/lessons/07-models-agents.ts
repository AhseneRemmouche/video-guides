import "dotenv/config";
import { AIMessage, createAgent, HumanMessage } from "langchain";
import { MODEL_ID } from "../src/models.js";

const agent = createAgent({ model: MODEL_ID });

const stream = await agent.stream(
  {
    messages: [
      new HumanMessage("what is the capital of italy?"),
      new AIMessage("Rome (Italian: Roma)."),
      new HumanMessage("tell me more about it"),
    ],
  },
  { streamMode: "messages" },
);

for await (const [token, metadata] of stream) {
  if (token.text) {
    process.stdout.write(token.text);
  }
}
