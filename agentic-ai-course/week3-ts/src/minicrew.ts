// A small "crew" runner on the OpenAI Agents SDK, so the Week 3 CrewAI projects can be followed in TypeScript.
// CrewAI itself has no TypeScript version. This file reads the SAME agents.yaml / tasks.yaml as the course,
// builds the system prompt and task prompt with CrewAI's own wording (crewai/translations/en.json), and runs the
// tasks one after another (sequential) or through a manager agent that delegates (hierarchical).
// Not implemented: CrewAI's memory, knowledge sources, planning, and its ReAct-style "Thought:/Final Answer:" format
// (the Agents SDK uses native tool calling instead).
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import OpenAI from "openai";
import YAML from "yaml";
import { Agent, OpenAIChatCompletionsModel, run, setDefaultOpenAIClient, setOpenAIAPI, setTracingDisabled, type Tool } from "@openai/agents";
import type { z } from "zod";

export const LOCAL = Boolean(process.env.OPENAI_BASE_URL);
if (LOCAL) {
  setDefaultOpenAIClient(new OpenAI({ baseURL: process.env.OPENAI_BASE_URL, apiKey: process.env.OPENAI_API_KEY ?? "ollama" }));
  setOpenAIAPI("chat_completions");
  setTracingDisabled(true);
}

// ---------- the YAML files ----------
export type AgentConfig = { role: string; goal: string; backstory: string; llm?: string };
export type TaskConfig = { description: string; expected_output: string; agent: string; context?: string[]; output_file?: string };

/** Fill {placeholders} from the inputs, like kickoff(inputs=...) does. Unknown placeholders are left alone. */
export function interpolate(text: string, inputs: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (m, key) => (key in inputs ? inputs[key]! : m));
}

export async function loadCrew(dir: string, inputs: Record<string, string>) {
  const read = async (f: string) => YAML.parse(interpolate(await readFile(join(dir, f), "utf-8"), inputs));
  return { agents: (await read("agents.yaml")) as Record<string, AgentConfig>, tasks: (await read("tasks.yaml")) as Record<string, TaskConfig> };
}

// ---------- LiteLLM-style model strings: "provider/model" ----------
const PROVIDERS: Record<string, { baseURL: string; key: string }> = {
  anthropic: { baseURL: "https://api.anthropic.com/v1/", key: "ANTHROPIC_API_KEY" }, // OpenAI-compatibility layer
  gemini: { baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/", key: "GOOGLE_API_KEY" },
  deepseek: { baseURL: "https://api.deepseek.com/v1", key: "DEEPSEEK_API_KEY" },
  groq: { baseURL: "https://api.groq.com/openai/v1", key: "GROQ_API_KEY" },
  ollama: { baseURL: "http://localhost:11434/v1", key: "OLLAMA_API_KEY" },
};

/** "openai/gpt-4o-mini" → "gpt-4o-mini"; "groq/llama-3.3-70b-versatile" → a Chat Completions model on Groq. */
export function modelFor(llm = "openai/gpt-4o-mini") {
  if (LOCAL) return process.env.MODEL ?? "llama3.2"; // every agent on the local model
  const [provider, ...rest] = llm.includes("/") ? llm.split("/") : ["openai", llm];
  const name = rest.join("/");
  if (provider === "openai") return name;
  const p = PROVIDERS[provider!];
  if (!p) throw new Error(`Unknown provider in llm: ${llm}`);
  const client = new OpenAI({ baseURL: p.baseURL, apiKey: process.env[p.key] ?? "none" });
  return new OpenAIChatCompletionsModel(client, name);
}

// ---------- CrewAI's prompt wording ----------
/** CrewAI "role_playing": the system prompt built from role, backstory and goal. */
export function instructionsFor(a: AgentConfig) {
  return `You are ${a.role.trim()}. ${a.backstory.trim()}\nYour personal goal is: ${a.goal.trim()}`;
}

/** CrewAI "expected_output" and "task_with_context" slices. */
export function taskPrompt(t: TaskConfig, context: string) {
  let prompt =
    `${t.description.trim()}\n\nThis is the expected criteria for your final answer: ${t.expected_output.trim()}\n` +
    `you MUST return the actual complete content as the final answer, not a summary.`;
  if (context) prompt += `\n\nThis is the context you're working with:\n${context}`;
  return prompt;
}

export type CrewEvent =
  | { type: "task_start"; task: string; agent: string }
  | { type: "task_end"; task: string; agent: string; output: string }
  | { type: "log"; text: string };

export type CrewOptions = {
  tools?: Record<string, Tool[]>; // agent name → tools
  outputTypes?: Record<string, z.ZodTypeAny>; // task name → structured output (CrewAI's output_pydantic)
  outputDir?: string; // where output_file paths are written (default: current folder)
  onEvent?: (e: CrewEvent) => void;
};

function makeAgent(name: string, cfg: AgentConfig, opts: CrewOptions, outputType?: z.ZodTypeAny) {
  return new Agent({
    name,
    instructions: instructionsFor(cfg),
    model: modelFor(cfg.llm),
    tools: opts.tools?.[name] ?? [],
    ...(outputType ? { outputType } : {}),
  });
}

async function saveOutput(t: TaskConfig, output: string, opts: CrewOptions) {
  if (!t.output_file) return;
  const path = join(opts.outputDir ?? ".", t.output_file);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, output, "utf-8");
}

const asText = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v, null, 2));

/** Process.sequential: run every task in the order of tasks.yaml. */
export async function runSequential(crew: Awaited<ReturnType<typeof loadCrew>>, opts: CrewOptions = {}) {
  const outputs: Record<string, string> = {};
  for (const [taskName, t] of Object.entries(crew.tasks)) {
    const cfg = crew.agents[t.agent];
    if (!cfg) throw new Error(`Task ${taskName} names unknown agent ${t.agent}`);
    // No "context" listed → all previous outputs (CrewAI's NOT_SPECIFIED rule); a list → only those tasks.
    const context = (t.context ?? Object.keys(outputs)).map((n) => outputs[n] ?? "").filter(Boolean).join("\n\n----------\n\n");
    opts.onEvent?.({ type: "task_start", task: taskName, agent: cfg.role.trim() });
    const agent = makeAgent(t.agent, cfg, opts, opts.outputTypes?.[taskName]);
    const result = await run(agent, taskPrompt(t, context), { maxTurns: 15 });
    const output = asText(result.finalOutput);
    outputs[taskName] = output;
    await saveOutput(t, output, opts);
    opts.onEvent?.({ type: "task_end", task: taskName, agent: cfg.role.trim(), output });
  }
  return outputs;
}

/** Process.hierarchical: a manager agent receives every task and delegates to the workers, which are its tools. */
export async function runHierarchical(crew: Awaited<ReturnType<typeof loadCrew>>, managerName: string, opts: CrewOptions = {}) {
  const managerCfg = crew.agents[managerName];
  if (!managerCfg) throw new Error(`No manager agent ${managerName} in agents.yaml`);
  const outputs: Record<string, string> = {};
  const workers = Object.entries(crew.agents).filter(([n]) => n !== managerName);
  // CrewAI gives the manager "Delegate work to coworker" and "Ask question to coworker" tools; here each worker is
  // one tool (agent as a tool, as in Week 2).
  const coworkerTools = workers.map(([n, cfg]) =>
    makeAgent(n, cfg, opts).asTool({ toolName: n, toolDescription: `Delegate work to ${cfg.role.trim()}. Give full context: they know nothing else.` }),
  );
  const makeManager = (outputType?: z.ZodTypeAny) =>
    new Agent({
      name: managerName,
      instructions: instructionsFor(managerCfg),
      model: modelFor(managerCfg.llm),
      tools: coworkerTools,
      ...(outputType ? { outputType } : {}),
    });
  for (const [taskName, t] of Object.entries(crew.tasks)) {
    const context = (t.context ?? Object.keys(outputs)).map((n) => outputs[n] ?? "").filter(Boolean).join("\n\n----------\n\n");
    opts.onEvent?.({ type: "task_start", task: taskName, agent: managerCfg.role.trim() });
    const agent = makeManager(opts.outputTypes?.[taskName]);
    const result = await run(agent, taskPrompt(t, context), { maxTurns: 20 });
    const output = asText(result.finalOutput);
    outputs[taskName] = output;
    await saveOutput(t, output, opts);
    opts.onEvent?.({ type: "task_end", task: taskName, agent: managerCfg.role.trim(), output });
  }
  return outputs;
}

/** Print progress in the console, like CrewAI's verbose=True. */
export const consoleEvents = (e: CrewEvent) => {
  if (e.type === "task_start") console.log(`\n# Agent: ${e.agent}\n## Task: ${e.task} …`);
  else if (e.type === "task_end") console.log(`## Final Answer (${e.task}):\n${e.output.slice(0, 1200)}${e.output.length > 1200 ? " …" : ""}`);
  else console.log(e.text);
};
