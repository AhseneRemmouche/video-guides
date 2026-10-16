// Port of 6_mcp/accounts_client.py — a hand-written MCP client for our accounts server.
// Each function starts the server as a child process, opens a session, does one thing and closes it again,
// exactly like the Python version's "async with stdio_client(...) / ClientSession(...)" blocks.
// Differences: Client + StdioClientTransport from @modelcontextprotocol/client v2 replace ClientSession + stdio_client,
// a small withSession() helper replaces the repeated "async with" blocks, and tool() from @openai/agents with a plain
// JSON schema replaces FunctionTool(params_json_schema=...). The server runs with "node --import tsx" (the "uv run" of TS).
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { tool } from "@openai/agents";

const params = { command: process.execPath, args: ["--import", "tsx", "src/accounts_server.ts"] };

async function withSession<T>(work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ name: "accounts_client", version: "1.0.0" });
  await client.connect(new StdioClientTransport(params)); // spawns the server and runs the initialize handshake
  try {
    return await work(client);
  } finally {
    await client.close();
  }
}

export async function listAccountsTools() {
  return withSession(async (client) => (await client.listTools()).tools);
}

export async function callAccountsTool(toolName: string, toolArgs: Record<string, unknown>) {
  return withSession((client) => client.callTool({ name: toolName, arguments: toolArgs }));
}

async function readText(uri: string): Promise<string> {
  return withSession(async (client) => {
    const result = await client.readResource({ uri });
    const first = result.contents[0];
    return "text" in first ? first.text : "";
  });
}

export const readAccountsResource = (name: string) => readText(`accounts://accounts_server/${name}`);
export const readStrategyResource = (name: string) => readText(`accounts://strategy/${name}`);

/** Turn each MCP tool into an Agents SDK function tool whose execute() calls the MCP server. */
export async function getAccountsToolsOpenai() {
  const openaiTools = [];
  for (const t of await listAccountsTools()) {
    const schema = { ...t.inputSchema, additionalProperties: false } as any;
    openaiTools.push(
      tool({
        name: t.name,
        description: t.description ?? "",
        parameters: schema,
        strict: true,
        execute: async (args) => JSON.stringify(await callAccountsTool(t.name, args as Record<string, unknown>)),
      }),
    );
  }
  return openaiTools;
}
