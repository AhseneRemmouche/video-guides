import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * Client for our Social Publisher MCP server (mcp/social-publisher/server.ts). The server is started once
 * as a child process speaking MCP over stdio and reused by every agent call.
 */

const g = globalThis as unknown as { __socialMcp?: Promise<Client> };

async function connect(): Promise<Client> {
  const root = process.cwd();
  const transport = new StdioClientTransport({
    command: process.execPath, // the same Node that runs the app
    args: ["--import", "tsx", path.join(root, "mcp", "social-publisher", "server.ts")],
    cwd: root,
    env: { ...(process.env as Record<string, string>) },
    stderr: "inherit",
  });
  const client = new Client({ name: "socialix", version: "1.0.0" });
  await client.connect(transport);
  transport.onclose = () => {
    g.__socialMcp = undefined; // reconnect on next use
  };
  return client;
}

export function socialMcp(): Promise<Client> {
  g.__socialMcp ??= connect().catch((e) => {
    g.__socialMcp = undefined;
    throw e;
  });
  return g.__socialMcp;
}

/** The MCP tools as Claude tool definitions, optionally filtered by name. */
export async function socialTools(names?: string[]): Promise<Anthropic.Tool[]> {
  const { tools } = await (await socialMcp()).listTools();
  return tools
    .filter((t) => !names || names.includes(t.name))
    .map((t) => ({
      name: t.name,
      description: t.description ?? "",
      input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
    }));
}

/** Call an MCP tool and return its text content (errors come back as text, not exceptions). */
export async function callSocialTool(name: string, args: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
  const result = await (await socialMcp()).callTool({ name, arguments: args });
  const content = (result.content ?? []) as { type: string; text?: string }[];
  return {
    text: content.map((c) => (c.type === "text" ? c.text ?? "" : `[${c.type}]`)).join("\n"),
    isError: Boolean(result.isError),
  };
}
