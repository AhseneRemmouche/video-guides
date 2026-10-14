export const CHEF_PROMPT = "please find me a good recipe to cook";

// Fixed: the course joins two strings without a space ("...in the photo.once you do that...").
export const SYSTEM_CHEF_PROMPT =
  "You are the best chef in the world. Your mission is to look at the photo " +
  "and understand which ingredients are in it. " +
  "Once you know them, search online for a recipe that only needs these ingredients.";
