import "dotenv/config";
import { createAgent, initChatModel } from "langchain";
import { log } from "../src/logger.js";
import { buildImageMessage, chooseImageFile } from "./photo-decoder.js";
import { CHEF_PROMPT, SYSTEM_CHEF_PROMPT } from "./prompt.js";
import { webSearch } from "./tools.js";

// "provider:model" strings. Set CHEF_MODEL in .env to switch without touching code.
// Examples (check each provider's current model list; the model must accept images):
//   openai:gpt-5-nano              needs @langchain/openai        + OPENAI_API_KEY
//   anthropic:claude-haiku-4-5     needs @langchain/anthropic     + ANTHROPIC_API_KEY
//   google-genai:gemini-2.5-flash  needs @langchain/google-genai  + GOOGLE_API_KEY
//   ollama:gemma4                  needs @langchain/ollama        + Ollama running locally
const DEFAULT_MODEL = "openai:gpt-5-nano";

log.info("creating our agent...");
const agent = createAgent({
  model: await initChatModel(process.env.CHEF_MODEL ?? DEFAULT_MODEL),
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
