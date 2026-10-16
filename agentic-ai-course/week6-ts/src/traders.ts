// Port of 6_mcp/traders.py — one autonomous trader: a trader agent whose tools come from MCP servers (accounts, push,
// market) plus a researcher agent (fetch, Brave search, memory servers) wrapped as a tool. Each run opens every MCP server,
// runs the agent, closes the servers again, and switches between "trade" and "rebalance" for the next run.
// Differences: connectAll() + try/finally replace Python's AsyncExitStack; withTrace(name, fn, {traceId}) replaces
// "with trace(...)"; the provider clients in getModel() are created only when needed (a missing key then fails only
// for that model). In local mode (setup.ts) a plain model name goes to Ollama.
import OpenAI from "openai";
import { Agent, MCPServerStdio, OpenAIChatCompletionsModel, run, withTrace, type Model, type Tool } from "@openai/agents";
import { model } from "./setup.js";
import { readAccountsResource, readStrategyResource } from "./accounts_client.js";
import { makeTraceId } from "./tracers.js";
import { rebalanceMessage, researcherInstructions, researchTool, tradeMessage, traderInstructions } from "./templates.js";
import { researcherMcpServerParams, traderMcpServerParams, type StdioParams } from "./mcp_params.js";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const GROK_BASE_URL = "https://api.x.ai/v1";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const MAX_TURNS = 30;

const chat = (baseURL: string, apiKey: string | undefined, modelName: string) =>
  new OpenAIChatCompletionsModel(new OpenAI({ baseURL, apiKey }), modelName);

/** Pick the provider from the model name, as in the course: "a/b" -> OpenRouter, deepseek, grok, gemini, else OpenAI. */
export function getModel(modelName: string): string | Model {
  if (modelName.includes("/")) return chat(OPENROUTER_BASE_URL, process.env.OPENROUTER_API_KEY, modelName);
  else if (modelName.includes("deepseek")) return chat(DEEPSEEK_BASE_URL, process.env.DEEPSEEK_API_KEY, modelName);
  else if (modelName.includes("grok")) return chat(GROK_BASE_URL, process.env.GROK_API_KEY, modelName);
  else if (modelName.includes("gemini")) return chat(GEMINI_BASE_URL, process.env.GOOGLE_API_KEY, modelName);
  else return modelName;
}

async function getResearcher(mcpServers: MCPServerStdio[], modelName: string): Promise<Agent> {
  return new Agent({ name: "Researcher", instructions: researcherInstructions(), model: getModel(modelName), mcpServers });
}

async function getResearcherTool(mcpServers: MCPServerStdio[], modelName: string): Promise<Tool> {
  const researcher = await getResearcher(mcpServers, modelName);
  return researcher.asTool({ toolName: "Researcher", toolDescription: researchTool() });
}

/** Start every server in the list; if one fails, close the ones already started (what AsyncExitStack does for us in Python). */
async function connectAll(paramsList: StdioParams[]): Promise<MCPServerStdio[]> {
  const servers: MCPServerStdio[] = [];
  try {
    for (const params of paramsList) {
      const server = new MCPServerStdio({ ...params, clientSessionTimeoutSeconds: 120 });
      await server.connect();
      servers.push(server);
    }
    return servers;
  } catch (e) {
    await closeAll(servers);
    throw e;
  }
}

async function closeAll(servers: MCPServerStdio[]): Promise<void> {
  for (const server of [...servers].reverse()) await server.close().catch(() => {});
}

export class Trader {
  agent: Agent | null = null;
  doTrade = true;

  constructor(
    public name: string,
    public lastname = "Trader",
    public modelName = model("gpt-4o-mini"),
  ) {}

  async createAgent(traderMcpServers: MCPServerStdio[], researcherMcpServers: MCPServerStdio[]): Promise<Agent> {
    const tool = await getResearcherTool(researcherMcpServers, this.modelName);
    this.agent = new Agent({
      name: this.name,
      instructions: traderInstructions(this.name),
      model: getModel(this.modelName),
      tools: [tool],
      mcpServers: traderMcpServers,
    });
    return this.agent;
  }

  /** The account as JSON, without the (long) portfolio value time series. */
  async getAccountReport(): Promise<string> {
    const account = JSON.parse(await readAccountsResource(this.name));
    delete account.portfolio_value_time_series;
    return JSON.stringify(account);
  }

  async runAgent(traderMcpServers: MCPServerStdio[], researcherMcpServers: MCPServerStdio[]) {
    const agent = await this.createAgent(traderMcpServers, researcherMcpServers);
    const account = await this.getAccountReport();
    const strategy = await readStrategyResource(this.name);
    const message = this.doTrade ? tradeMessage(this.name, strategy, account) : rebalanceMessage(this.name, strategy, account);
    return run(agent, message, { maxTurns: MAX_TURNS });
  }

  async runWithMcpServers() {
    const traderMcpServers = await connectAll(traderMcpServerParams);
    try {
      const researcherMcpServers = await connectAll(researcherMcpServerParams(this.name));
      try {
        return await this.runAgent(traderMcpServers, researcherMcpServers);
      } finally {
        await closeAll(researcherMcpServers);
      }
    } finally {
      await closeAll(traderMcpServers);
    }
  }

  async runWithTrace() {
    const traceName = this.doTrade ? `${this.name}-trading` : `${this.name}-rebalancing`;
    const traceId = makeTraceId(this.name.toLowerCase());
    return withTrace(traceName, () => this.runWithMcpServers(), { traceId });
  }

  /** One run; errors are printed, not thrown, so one failing trader does not stop the others. */
  async run() {
    let result;
    try {
      result = await this.runWithTrace();
    } catch (e) {
      console.log(`Error running trader ${this.name}: ${e}`);
    }
    this.doTrade = !this.doTrade;
    return result;
  }
}
