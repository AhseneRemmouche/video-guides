import "dotenv/config";
import { createAgent } from "langchain";
import { log } from "../src/logger.js";
import { getVisionModel, PROVIDER } from "../src/models.js";
import { buildImageMessage, chooseImageFile } from "./photo-decoder.js";
import { CHEF_PROMPT, SYSTEM_CHEF_PROMPT } from "./prompt.js";
import { webSearch } from "./tools.js";

if (PROVIDER === "openai" && !process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is missing. Add it to your .env file (or set MODEL_PROVIDER=ollama).");
  process.exit(1);
}

log.info("creating our agent...");
const agent = createAgent({
  model: getVisionModel(), // the chef must see the photo
  tools: [webSearch],
  systemPrompt: SYSTEM_CHEF_PROMPT,
});

log.info("choosing our image...");
const imagePath = process.argv[2] ?? (await chooseImageFile());
const message = buildImageMessage(imagePath, CHEF_PROMPT);

log.info("invoking our agent...");
const response = await agent.invoke({
  messages: [message],
});

console.log(response.messages.at(-1)?.text);
