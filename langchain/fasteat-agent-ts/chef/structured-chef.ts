import "dotenv/config";
import { createAgent } from "langchain";
import { z } from "zod";
import { getVisionModel } from "../src/models.js";
import { buildImageMessage, chooseImageFile } from "./photo-decoder.js";
import { CHEF_PROMPT, SYSTEM_CHEF_PROMPT } from "./prompt.js";
import { webSearch } from "./tools.js";

const Recipe = z
  .object({
    title: z.string().describe("Name of the dish"),
    ingredients_seen: z.array(z.string()).describe("Ingredients you recognised in the photo"),
    ingredients: z.array(z.string()).describe("Everything the recipe needs, with quantities"),
    steps: z.array(z.string()).describe("Cooking steps, in order"),
    minutes: z.number().int().describe("Total cooking time in minutes"),
    source_url: z.string().nullable().describe("Web page the recipe came from, or null"),
  })
  .meta({ title: "Recipe", description: "A recipe that uses the ingredients found in the photo." });

const agent = createAgent({
  model: getVisionModel(),
  tools: [webSearch],
  systemPrompt: SYSTEM_CHEF_PROMPT,
  responseFormat: Recipe,
});

const imagePath = process.argv[2] ?? (await chooseImageFile());
const response = await agent.invoke({ messages: [buildImageMessage(imagePath, CHEF_PROMPT)] });

const recipe = response.structuredResponse;
// A small local model may answer in plain text instead of filling the Recipe schema: then there is no recipe object.
if (!recipe) {
  console.error("The model did not return a structured recipe. Its last message was:\n");
  console.error(response.messages.at(-1)?.text);
  process.exit(1);
}
console.log(`# ${recipe.title}  (${recipe.minutes} min)`);
console.log("Seen in the photo:", recipe.ingredients_seen.join(", "));
console.log("\nIngredients:");
for (const item of recipe.ingredients) {
  console.log(" -", item);
}
console.log("\nSteps:");
recipe.steps.forEach((step, index) => console.log(` ${index + 1}. ${step}`));
if (recipe.source_url) {
  console.log("\nSource:", recipe.source_url);
}
