// Week 2 Day 1 - a first Agent and run() (TypeScript port of 2_openai/1_lab1.py)
// Python: Agent(name, instructions, model) -> Runner.run(agent, prompt) -> result.final_output
// TypeScript: new Agent({ name, instructions, model }) -> run(agent, prompt) -> result.finalOutput
import { Agent, run, withTrace } from "@openai/agents";
import { MODEL } from "./setup.js";

// Make an agent with a name, instructions and a model.
const agent = new Agent({
  name: "Jokester",
  instructions: "You are a joke teller",
  model: MODEL,
});

// Run the joke with run(agent, prompt), inside a single trace, then print finalOutput.
await withTrace("Telling a joke", async () => {
  const result = await run(agent, "Tell a joke about Autonomous AI Agents");
  console.log(result.finalOutput);
});
