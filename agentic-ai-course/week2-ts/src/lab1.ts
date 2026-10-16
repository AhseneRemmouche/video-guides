// Week 2 Day 1 — first look at the OpenAI Agents SDK (TypeScript version of 2_openai/1_lab1.ipynb)
// Python: Agent(name, instructions, model) · Runner.run(agent, prompt) · with trace("...")
// TypeScript: new Agent({ name, instructions, model }) · run(agent, prompt) · withTrace("...", async () => ...)
import { Agent, run, withTrace } from "@openai/agents";
import { MODEL } from "./setup.js";

// Make an agent with name, instructions, model
const agent = new Agent({ name: "Jokester", instructions: "You are a joke teller", model: MODEL });

// Run the joke with run(agent, prompt) then print finalOutput
await withTrace("Telling a joke", async () => {
  const result = await run(agent, "Tell a joke about Autonomous AI Agents");
  console.log(result.finalOutput);
});
