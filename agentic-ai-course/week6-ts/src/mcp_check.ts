// Not in the course: a no-LLM check of Day 2. Starts the accounts MCP server through our own client and through the
// Agents SDK's MCPServerStdio, lists its tools, buys and sells through MCP and reads both resources. Needs no API key.
// Run: pnpm mcp-check   (uses the account "mcpcheck", which it resets first)
import { MCPServerStdio } from "@openai/agents";
import { Account } from "./accounts.js";
import { callAccountsTool, getAccountsToolsOpenai, listAccountsTools, readAccountsResource, readStrategyResource } from "./accounts_client.js";

const NAME = "mcpcheck";
Account.get(NAME).reset("A test account used by mcp_check.ts to exercise the MCP server.");

console.log("== 1. Our own client: list_tools ==");
for (const t of await listAccountsTools()) console.log(`- ${t.name}: ${t.description}\n  input: ${JSON.stringify(t.inputSchema)}`);

console.log("\n== 2. Converted to Agents SDK tools ==");
for (const t of await getAccountsToolsOpenai()) console.log(`- ${t.type} tool ${t.name} (strict: ${"strict" in t ? t.strict : "n/a"})`);

const show = (label: string, result: unknown) => console.log(`\n== ${label} ==\n${JSON.stringify(result, null, 2)}`);
show("3. call_tool get_balance", await callAccountsTool("get_balance", { name: NAME }));
show("4. call_tool buy_shares AMZN x3", await callAccountsTool("buy_shares", { name: NAME, symbol: "AMZN", quantity: 3, rationale: "Because this bookstore website looks promising" }));
show("5. call_tool sell_shares AMZN x1", await callAccountsTool("sell_shares", { name: NAME, symbol: "AMZN", quantity: 1, rationale: "Taking a little profit" }));
show("6. call_tool get_holdings", await callAccountsTool("get_holdings", { name: NAME }));
show("7. call_tool sell_shares MSFT x5 (not held: expect a tool error)", await callAccountsTool("sell_shares", { name: NAME, symbol: "MSFT", quantity: 5, rationale: "test" }));
show("8. read_resource accounts://strategy/mcpcheck", await readStrategyResource(NAME));
show("9. read_resource accounts://accounts_server/mcpcheck", JSON.parse(await readAccountsResource(NAME)));

console.log("\n== 10. The Agents SDK's MCPServerStdio on the same server ==");
const server = new MCPServerStdio({ command: process.execPath, args: ["--import", "tsx", "src/accounts_server.ts"], clientSessionTimeoutSeconds: 30 });
await server.connect();
try {
  console.log((await server.listTools()).map((t) => t.name).join(", "));
  console.log("callTool get_balance ->", JSON.stringify(await server.callTool("get_balance", { name: NAME })));
} finally {
  await server.close();
}
