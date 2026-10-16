// Week 6 Day 1 — port of 6_mcp/1_lab1.ipynb: use ready-made MCP servers from the Agents SDK.
// 1. Spawn three third-party servers (Fetch via uvx; Playwright and Filesystem via npx) and list their tools.
// 2. An "investigator" agent with the browser and the files servers writes sandbox/banoffee.md.
// Differences: "async with MCPServerStdio(...) as server" becomes connect() ... finally close(); the course's Windows
// problem with MCP (it asks for WSL) does not apply here, because Node spawns npx/uvx fine on Windows.
// HEADLESS=1 (not in the course) runs the Playwright browser without a window.
// Run: pnpm lab1
import path from "node:path";
import { Agent, MCPServerStdio, run, withTrace } from "@openai/agents";
import { model, networkEnv } from "./setup.js";

type Params = { command: string; args: string[]; env?: Record<string, string> };

/** Open a server, list its tools, close it (cells 5, 8 and 9). */
async function listTools(label: string, params: Params) {
  const server = new MCPServerStdio({ ...params, clientSessionTimeoutSeconds: 60 });
  await server.connect();
  try {
    const tools = await server.listTools();
    console.log(`\n${label}: ${tools.length} tools`);
    for (const t of tools) console.log(`- ${t.name}: ${(t.description ?? "").split("\n")[0].slice(0, 110)}`);
  } finally {
    await server.close();
  }
}

const fetchParams = { command: "uvx", args: ["mcp-server-fetch"], env: networkEnv }; // networkEnv: see setup.ts
const playwrightParams = { command: "npx", args: ["@playwright/mcp@latest", ...(process.env.HEADLESS ? ["--headless"] : [])], env: networkEnv };
const sandboxPath = path.resolve("sandbox");
const filesParams = { command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", sandboxPath], env: networkEnv };

await listTools("Fetch (uvx mcp-server-fetch)", fetchParams);
await listTools("Playwright (npx @playwright/mcp@latest)", playwrightParams);
await listTools("Filesystem (npx @modelcontextprotocol/server-filesystem sandbox)", filesParams);

// And now.. bring on the Agent with Tools!
const instructions = `
You browse the internet to accomplish your instructions.
You are highly capable at browsing the internet independently to accomplish your task, 
including accepting all cookies and clicking 'not now' as
appropriate to get to the content you need. If one website isn't fruitful, try another. 
Be persistent until you have solved your assignment,
trying different options and sites as needed.
When you need to write files, you do that inside the sandbox folder only.
`;

const mcpServerFiles = new MCPServerStdio({ ...filesParams, clientSessionTimeoutSeconds: 60 });
const mcpServerBrowser = new MCPServerStdio({ ...playwrightParams, clientSessionTimeoutSeconds: 60 });
await mcpServerFiles.connect();
await mcpServerBrowser.connect();
try {
  const agent = new Agent({
    name: "investigator",
    instructions,
    model: model("gpt-4.1-mini"),
    mcpServers: [mcpServerFiles, mcpServerBrowser],
  });
  await withTrace("investigate", async () => {
    const result = await run(agent, "Find a great recipe for Banoffee Pie, then summarize it in markdown to banoffee.md");
    console.log("\n" + result.finalOutput);
  });
} finally {
  await mcpServerBrowser.close();
  await mcpServerFiles.close();
}
