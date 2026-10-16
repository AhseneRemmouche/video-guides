// Week 5 Day 5 — the Agent Creator (TypeScript version of 5_autogen/creator.py)
//
// The Creator receives a file name such as "agent5.ts", asks an LLM to write a new agent using src/agent.ts as the
// template, saves it, imports it with a dynamic import() (Python: importlib.import_module), registers the new agent
// type with the runtime it lives in, and asks the new agent for a business idea.
// (agent.ts itself carries no header comment on purpose: its whole text is sent to the LLM as the template.)
//
// SAFETY, as the presenter says: this writes LLM-generated code to disk and then RUNS it on your machine with no
// guardrails. Run it at your own risk, read the generated files, keep HOW_MANY_AGENTS small, or don't run it at all.
// The generated code can import anything Node can (files, network), exactly like the Python version.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Agent as LLMAgent } from "@openai/agents";
import { AssistantAgent } from "./core/assistant.js";
import { AgentId, messageHandler, RoutedAgent, type MessageContext } from "./core/runtime.js";
import * as messages from "./messages.js";
import { MODEL } from "./setup.js";

export class Creator extends RoutedAgent {
  // Change this system message to reflect the unique characteristics of this agent

  systemMessage = `
    You are an Agent that is able to create new AI Agents.
    You receive a template in the form of TypeScript code that creates an Agent using a small AutoGen-Core-like runtime and the OpenAI Agents SDK.
    You should use this template to create a new Agent with a unique system message that is different from the template,
    and reflects their unique characteristics, interests and goals.
    You can choose to keep their overall goal the same, or change it.
    You can choose to take this Agent in a completely different direction. The only requirement is that the class must be named Agent,
    and it must extend RoutedAgent and have a constructor that takes a name parameter.
    Also avoid environmental interests - try to mix up the business verticals so that every agent is different.
    Respond only with the TypeScript code, no other text, and no markdown code blocks.
    `;

  private delegate: AssistantAgent<string>;

  constructor(name: string) {
    super(name);
    const llm = new LLMAgent({ name, model: MODEL, modelSettings: { temperature: 1.0 }, instructions: this.systemMessage });
    this.delegate = new AssistantAgent(llm);
  }

  getUserPrompt() {
    const prompt =
      "Please generate a new Agent based strictly on this template. Stick to the class structure. " +
      "Respond only with the TypeScript code, no other text, and no markdown code blocks.\n\n" +
      "Be creative about taking the agent in a new direction, but don't change method signatures.\n\n" +
      "Here is the template:\n\n";
    const template = readFileSync(path.join(messages.AGENTS_DIR, "agent.ts"), "utf-8");
    return prompt + template;
  }

  @messageHandler(messages.Message)
  async handleMyMessageType(message: messages.Message, ctx: MessageContext): Promise<messages.Message> {
    const filename = message.content; // e.g. "agent5.ts"
    const agentName = filename.split(".")[0];
    let code = await this.delegate.reply(this.getUserPrompt(), ctx.signal);
    // Not in the Python: small local models often wrap the code in ``` fences anyway, so strip them if present
    code = code.replace(/^\s*```[a-z]*\s*\n/i, "").replace(/\n```\s*$/, "\n");
    const file = path.join(messages.AGENTS_DIR, filename);
    writeFileSync(file, code, "utf-8");
    console.log(`** Creator has created code for agent ${agentName} - about to register with Runtime`);
    const module = await import(pathToFileURL(file).href); // Python: importlib.import_module(agent_name)
    await module.Agent.register(this.runtime, agentName, () => new module.Agent(agentName));
    console.log(`** Agent ${agentName} is live`);
    const result = await this.sendMessage<messages.Message>(new messages.Message("Give me an idea"), new AgentId(agentName, "default"));
    return new messages.Message(result.content);
  }
}
