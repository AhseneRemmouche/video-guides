// The two models behind the web app:
// 1. the vision model lists what it sees in the fridge photo,
// 2. the chef agent (text model + web search + memory per conversation) turns that list into a recipe.
import { MemorySaver } from "@langchain/langgraph";
import { createAgent } from "langchain";
import { buildDataUrlMessage } from "../chef/photo-decoder.js";
import { webSearch } from "../chef/tools.js";
import { getModel, getVisionModel } from "../src/models.js";

const INGREDIENTS_PROMPT =
  "List the food ingredients you can see in this photo, one per line, with no other text. " +
  "If you see no food, answer: none.";

/** Ask the vision model which ingredients are in the photo. */
export async function decodeIngredients(dataUrl: string): Promise<string> {
  const answer = await getVisionModel().invoke([buildDataUrlMessage(dataUrl, INGREDIENTS_PROMPT)]);
  return answer.text.trim();
}

export const chefAgent = createAgent({
  model: getModel(),
  tools: [webSearch],
  systemPrompt:
    "You are the best chef in the world. You receive the list of ingredients found in a fridge photo. " +
    "Search online for a recipe that only needs these ingredients, then give the recipe: a title, " +
    "the ingredients with quantities, and numbered steps. Answer follow-up questions about it briefly.",
  checkpointer: new MemorySaver(), // one memory per conversation (thread_id), kept while the server runs
});
