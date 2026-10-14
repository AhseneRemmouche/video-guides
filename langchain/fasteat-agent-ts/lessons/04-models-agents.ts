import "dotenv/config";
import { initChatModel } from "langchain";
import { MODEL_ID } from "../src/models.js";

// 0 to 1 from least creative to most creative
// (gpt-5 models only accept the default, 1: try another value with a model that supports it)
const model = await initChatModel(MODEL_ID, {
  temperature: 1.0,
});

const response = await model.invoke("tell me story");

console.log(response.text);
