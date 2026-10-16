// Week 5 Day 5 — the message type shared by the Creator and every agent it creates (TypeScript version of 5_autogen/messages.py)
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AgentId } from "./core/runtime.js";

export class Message {
  constructor(public content: string) {}
}

export const AGENTS_DIR = path.dirname(fileURLToPath(import.meta.url)); // src/, where agent.ts and agentN.ts live

/** Pick a random created agent by looking at the agentN.ts files on disk (the course calls this "super hacky":
 *  the file may not be registered yet, and the agent may pick itself). */
export function findRecipient(): AgentId {
  try {
    const agentFiles = readdirSync(AGENTS_DIR).filter((f) => /^agent\d+\.ts$/.test(f)); // Python: glob("agent*.py") minus "agent"
    const agentNames = agentFiles.map((f) => path.parse(f).name);
    if (agentNames.length === 0) throw new Error("no agents yet");
    const agentName = agentNames[Math.floor(Math.random() * agentNames.length)];
    console.log(`Selecting agent for refinement: ${agentName}`);
    return new AgentId(agentName, "default");
  } catch (e) {
    console.log(`Exception finding recipient: ${e}`);
    return new AgentId("agent1", "default");
  }
}
