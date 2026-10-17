import Anthropic from "@anthropic-ai/sdk";
import { asc, eq, and } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { AgentRole } from "@/lib/db/schema";
import { config } from "@/lib/env";
import { TEAM, systemPrompt } from "./agents";
import { TOOLS, type ToolContext } from "./tools";

/**
 * The agent loop: send the conversation and the agent's tools to Claude, run any tools it asks for, send the
 * results back, and repeat until it answers. Web search is a server tool: Anthropic runs it, and a long
 * search may end a turn with "pause_turn", in which case we simply continue.
 */

const g = globalThis as unknown as { __anthropic?: Anthropic };
function anthropic(): Anthropic {
  g.__anthropic ??= new Anthropic({ apiKey: config.anthropicApiKey });
  return g.__anthropic;
}

const MAX_STEPS = 16;

async function recordUsage(agent: AgentRole, model: string, msg: Anthropic.Message) {
  const searches = msg.content.filter((b) => b.type === "server_tool_use" && b.name === "web_search").length;
  await db.insert(schema.usage).values({ agent, model, inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens, webSearches: searches });
}

async function campaignBrief(campaignId: string) {
  const c = await db.query.campaigns.findFirst({ where: eq(schema.campaigns.id, campaignId) });
  if (!c) throw new Error("Campaign not found");
  return c;
}

/** Run one agent on a list of messages and return its final text answer. */
export async function runAgent(role: AgentRole, campaignId: string, messages: Anthropic.MessageParam[]): Promise<string> {
  const info = TEAM[role];
  const model = info.model();
  const tools = TOOLS[role];
  const system = systemPrompt(role, await campaignBrief(campaignId));
  const ctx: ToolContext = {
    campaignId,
    runSubAgent: (agent, instructions) => runAgent(agent, campaignId, [{ role: "user", content: instructions }]),
  };

  const convo = [...messages];
  for (let step = 0; step < MAX_STEPS; step++) {
    const msg = await anthropic().messages.create({
      model,
      max_tokens: 4096,
      system,
      tools: tools.map((t) => t.definition),
      messages: convo,
    });
    await recordUsage(role, model, msg);
    convo.push({ role: "assistant", content: msg.content });

    if (msg.stop_reason === "pause_turn") continue; // a server tool (web search) is still working
    const calls = msg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (msg.stop_reason !== "tool_use" || calls.length === 0) {
      return msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const call of calls) {
      const t = tools.find((x) => "name" in x.definition && x.definition.name === call.name);
      let content: string;
      let isError = false;
      try {
        content = t?.run ? await t.run(call.input, ctx) : `Unknown tool ${call.name}`;
      } catch (e) {
        content = `Tool failed: ${e instanceof Error ? e.message : "unknown error"}`;
        isError = true;
      }
      results.push({ type: "tool_result", tool_use_id: call.id, content, is_error: isError });
    }
    convo.push({ role: "user", content: results });
  }
  return "I stopped after too many steps. Please narrow the request.";
}

// ---------- Chat threads (what the dashboard calls) ----------

// "campaignId:agent" while a reply is being produced (kept on globalThis so hot reloads don't lose it)
const gr = globalThis as unknown as { __running?: Set<string> };
const running = (gr.__running ??= new Set<string>());

export function isRunning(campaignId: string, agent: AgentRole): boolean {
  return running.has(`${campaignId}:${agent}`);
}

/**
 * Save the owner's message and produce the agent's reply in the background. The dashboard polls the
 * messages and tasks while it works, like the video's live office.
 */
export async function startChat(campaignId: string, agent: AgentRole, text: string): Promise<void> {
  const key = `${campaignId}:${agent}`;
  if (running.has(key)) throw new Error("This agent is still working on the last message.");
  await db.insert(schema.agentMessages).values({ campaignId, agent, role: "user", content: text });
  running.add(key);

  void (async () => {
    try {
      const history = await db.query.agentMessages.findMany({
        where: and(eq(schema.agentMessages.campaignId, campaignId), eq(schema.agentMessages.agent, agent)),
        orderBy: asc(schema.agentMessages.createdAt),
      });
      const messages: Anthropic.MessageParam[] = history.slice(-20).map((m) => ({ role: m.role, content: m.content }));
      while (messages.length && messages[0]!.role !== "user") messages.shift();
      const reply = await runAgent(agent, campaignId, messages);
      await db.insert(schema.agentMessages).values({ campaignId, agent, role: "assistant", content: reply || "(no reply)" });
    } catch (e) {
      const message = e instanceof Anthropic.APIError ? `Claude API error ${e.status}: ${e.message}` : e instanceof Error ? e.message : "unknown error";
      await db.insert(schema.agentMessages).values({ campaignId, agent, role: "assistant", content: `Sorry, something went wrong: ${message}` });
    } finally {
      running.delete(key);
    }
  })();
}
