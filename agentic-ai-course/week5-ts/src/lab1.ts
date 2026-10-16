// Week 5 Day 1 — AutoGen AgentChat basics (TypeScript version of 5_autogen/1_lab1_autogen_agentchat.ipynb)
//
// AutoGen has no JavaScript version, so this port uses the OpenAI Agents SDK for JavaScript. The building blocks map 1:1:
//   model client      OpenAIChatCompletionClient(model="gpt-4o-mini")  ->  a model name string (or ollamaModel())
//   message           TextMessage(content=..., source="user")          ->  user("...") input item
//   agent             AssistantAgent(name, model_client, system_message) -> new Agent({ name, model, instructions })
//   send + await      await agent.on_messages([message], CancellationToken()) -> await run(agent, [message])
//   tool              a plain Python function (docstring = description)  -> tool({ name, description, parameters: zod })
import { existsSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite"; // built in to Node 22.5+, no package needed
import { Agent, run, tool, user } from "@openai/agents";
import { z } from "zod";
import { MODEL, ollamaModel } from "./setup.js";

// ---------- The model ----------
// Python: model_client = OpenAIChatCompletionClient(model="gpt-4o-mini")
// In the Agents SDK the model is just a name passed to each Agent; setup.ts decides which server answers.
const modelClient = MODEL;
// Python: ollamamodel_client = OllamaChatCompletionClient(model="llama3.2")  (shown, not used, in the video)
const ollamaModelClient = ollamaModel();
void ollamaModelClient; // swap it in for modelClient below to run everything on Ollama

// ---------- The message ----------
// Python: message = TextMessage(content="I'd like to go to London", source="user")
const message = user("I'd like to go to London");
console.log(message);

// ---------- The agent ----------
const agent = new Agent({
  name: "airline_agent",
  model: modelClient,
  instructions: "You are a helpful assistant for an airline. You give short, humorous answers.",
});

// Python: response = await agent.on_messages([message], cancellation_token=CancellationToken())
// The JavaScript twin of a CancellationToken is an AbortSignal; we pass one only to show where it goes.
const response = await run(agent, [message], { signal: new AbortController().signal });
console.log(response.finalOutput);

// ---------- A SQLite database of ticket prices ----------
const DB = "tickets.db";
if (existsSync(DB)) rmSync(DB);
const conn = new DatabaseSync(DB);
conn.exec("CREATE TABLE cities (city_name TEXT PRIMARY KEY, round_trip_price REAL)");
conn.close();

function saveCityPrice(cityName: string, roundTripPrice: number) {
  const db = new DatabaseSync(DB);
  db.prepare("REPLACE INTO cities (city_name, round_trip_price) VALUES (?, ?)").run(cityName.toLowerCase(), roundTripPrice);
  db.close();
}

saveCityPrice("London", 299);
saveCityPrice("Paris", 399);
saveCityPrice("Rome", 499);
saveCityPrice("Madrid", 550);
saveCityPrice("Barcelona", 580);
saveCityPrice("Berlin", 525);

/** Get the roundtrip ticket price to travel to the city (same body as the Python get_city_price) */
function getCityPrice(cityName: string): number | null {
  const db = new DatabaseSync(DB);
  const row = db.prepare("SELECT round_trip_price FROM cities WHERE city_name = ?").get(cityName.toLowerCase()) as
    | { round_trip_price: number }
    | undefined;
  db.close();
  return row ? row.round_trip_price : null;
}

console.log("getCityPrice('Rome') =", getCityPrice("Rome"));

// ---------- The tool ----------
// AutoGen reads the docstring and type hints of a plain function. TypeScript types vanish at run time,
// so the description and the parameter schema are written out explicitly.
const getCityPriceTool = tool({
  name: "get_city_price",
  description: "Get the roundtrip ticket price to travel to the city",
  parameters: z.object({ city_name: z.string() }),
  execute: async ({ city_name }) => String(getCityPrice(city_name)),
});

// reflect_on_tool_use=True in AutoGen = "call the model again after the tool to write the answer".
// That is the Agents SDK default (toolUseBehavior: "run_llm_again"), so nothing extra is needed.
const smartAgent = new Agent({
  name: "smart_airline_agent",
  model: modelClient,
  instructions: "You are a helpful assistant for an airline. You give short, humorous answers, including the price of a roundtrip ticket.",
  tools: [getCityPriceTool],
});

const smartResponse = await run(smartAgent, [message]);
// Python prints response.inner_messages (FunctionCall, FunctionExecutionResult). The SDK calls them newItems.
for (const item of smartResponse.newItems) {
  if (item.type === "tool_call_item") console.log("[FunctionCall]", JSON.stringify(item.rawItem));
  if (item.type === "tool_call_output_item") console.log("[FunctionExecutionResult]", JSON.stringify(item.output));
}
console.log(smartResponse.finalOutput);
