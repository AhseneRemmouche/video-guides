// A small tool-using agent: the model decides which tool to call, the code runs it, repeat.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import * as config from "./config.js";
import { DATA } from "./config.js";
import { loadChunks } from "./docs.js";
import { client } from "./llm.js";
import { Hybrid } from "./retrieve.js";

interface Order {
  id: string;
  customer: string;
  [field: string]: unknown;
}

const ORDERS = new Map<string, Order>(
  (JSON.parse(readFileSync(path.join(DATA, "orders.json"), "utf8")) as Order[]).map((o) => [o.id, o]),
);
let retriever: Hybrid | undefined;

export async function searchDocs({ query }: { query: string }): Promise<string> {
  retriever ??= new Hybrid(loadChunks());
  return (await retriever.search(query, 3)).map(([c]) => `[${c.id}] ${c.text}`).join("\n\n");
}

export function makeGetOrder(customerId: string) {
  return function getOrder({ order_id }: { order_id: string }): string {
    const order = ORDERS.get(order_id.trim().toUpperCase());
    // Authorization lives in the tool, not in the prompt: the model can't talk its way past this check.
    if (!order || order.customer !== customerId) return `No order ${order_id} found for this customer.`;
    return JSON.stringify(order);
  };
}

export const TODAY = "2026-10-12"; // fixed so the lab's results are repeatable

export function daysSince({ iso_date }: { iso_date: string }): string {
  const ms = Date.parse(`${TODAY}T00:00:00Z`) - Date.parse(`${iso_date}T00:00:00Z`);
  if (Number.isNaN(ms)) throw new Error(`not a YYYY-MM-DD date: ${iso_date}`);
  return String(Math.round(ms / 86_400_000));
}

export const TOOLS: ChatCompletionTool[] = [
  { type: "function", function: {
    name: "search_docs", description: "Search the shop's policies (returns, warranty, shipping, battery care, sizing, service plans, stores, payment).",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
  { type: "function", function: {
    name: "get_order", description: "Look up one of the current customer's orders by its number, like TH-10234.",
    parameters: { type: "object", properties: { order_id: { type: "string" } }, required: ["order_id"] } } },
  { type: "function", function: {
    name: "days_since", description: "Number of days between a date (YYYY-MM-DD) and today.",
    parameters: { type: "object", properties: { iso_date: { type: "string" } }, required: ["iso_date"] } } },
];

export const SYSTEM = `You are the support agent of Trailhead Bikes. Today is ${TODAY}.
Use the tools to look up policies and orders; never guess a policy, price or date.
When you have what you need, answer the customer in two or three sentences.`;

export interface Step {
  step: number;
  tool: string;
  args: unknown;
  result: string;
}

export interface AgentOptions {
  customerId?: string;
  maxSteps?: number;
  model?: string;
  verbose?: boolean;
  onStep?: (step: Step) => void; // the web server uses this to stream each tool call to the browser
}

/** Returns the answer and the trace: every tool call, for debugging and evaluation. */
export async function runAgent(question: string, opts: AgentOptions = {}): Promise<{ answer: string; trace: Step[] }> {
  const { customerId = "c-001", maxSteps = 6, model, verbose = true, onStep } = opts;
  const tools: Record<string, (args: any) => string | Promise<string>> = {
    search_docs: searchDocs, get_order: makeGetOrder(customerId), days_since: daysSince,
  };
  const messages: ChatCompletionMessageParam[] = [{ role: "system", content: SYSTEM }, { role: "user", content: question }];
  const trace: Step[] = [];
  for (let step = 0; step < maxSteps; step++) {
    const response = await client.chat.completions.create({ model: model ?? config.MODEL, messages, tools: TOOLS, temperature: 0 });
    const message = response.choices[0]!.message;
    if (!message.tool_calls?.length) return { answer: message.content ?? "", trace };
    messages.push(message);
    for (const call of message.tool_calls) {
      if (call.type !== "function") continue;
      const name = call.function.name;
      let args: unknown;
      let result: string;
      try {
        args = JSON.parse(call.function.arguments || "{}");
        const fn = tools[name];
        if (!fn) throw new Error(`unknown tool ${name}`);
        result = await fn(args);
      } catch (error) { // a bad tool call becomes feedback the model can recover from
        args = call.function.arguments;
        result = `Tool error: ${error instanceof Error ? error.message : String(error)}`;
      }
      const entry = { step, tool: name, args, result: result.slice(0, 200) };
      trace.push(entry);
      onStep?.(entry);
      if (verbose) console.log(`   step ${step}: ${name}(${JSON.stringify(args)}) -> ${JSON.stringify(result.slice(0, 90))}`);
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }
  return { answer: "Sorry, I could not finish this request. A colleague will contact you.", trace };
}
