// Week 6 Day 2 — port of 6_mcp/2_lab2.ipynb: our own MCP server and our own MCP client.
// 1. Use accounts.ts directly (buy 3 AMZN for Ed).  2. Run accounts_server.ts as an MCP server for an agent.
// 3. Use the hand-written client (accounts_client.ts): its tools for an agent, and a resource read.
// Run: pnpm lab2
import { Agent, MCPServerStdio, run, withTrace } from "@openai/agents";
import { model } from "./setup.js";
import { Account } from "./accounts.js";
import { getAccountsToolsOpenai, listAccountsTools, readAccountsResource } from "./accounts_client.js";

// Cells 2-6: the business logic on its own
const account = Account.get("Ed");
console.log(account.data());
console.log(await account.buyShares("AMZN", 3, "Because this bookstore website looks promising"));
console.log(await account.report());
console.log(account.listTransactions());

// Cells 8-9: now let's use our accounts server as an MCP server
const params = { command: process.execPath, args: ["--import", "tsx", "src/accounts_server.ts"], clientSessionTimeoutSeconds: 30 };
const server = new MCPServerStdio(params);
await server.connect();
console.log((await server.listTools()).map((t) => t.name));
await server.close();

// Cells 10-11: an agent that uses the MCP server
const instructions = "You are able to manage an account for a client, and answer questions about the account.";
let request = "My name is Ed and my account is under the name Ed. What's my balance and my holdings?";
const courseModel = model("gpt-4.1-mini");

const mcpServer = new MCPServerStdio(params);
await mcpServer.connect();
try {
  const agent = new Agent({ name: "account_manager", instructions, model: courseModel, mcpServers: [mcpServer] });
  const result = await withTrace("account_manager", () => run(agent, request));
  console.log("\n" + result.finalOutput);
} finally {
  await mcpServer.close();
}

// Cells 13-14: now let's build our own MCP Client
console.log(await listAccountsTools());
const openaiTools = await getAccountsToolsOpenai();
console.log(openaiTools.map((t) => t.name));

request = "My name is Ed and my account is under the name Ed. What's my balance?";
await withTrace("account_mcp_client", async () => {
  const agent = new Agent({ name: "account_manager", instructions, model: courseModel, tools: openaiTools });
  const result = await run(agent, request);
  console.log("\n" + result.finalOutput);
});

// Cells 15-16: read a resource through the client, then the same report directly
console.log(await readAccountsResource("ed"));
console.log(await Account.get("ed").report());
