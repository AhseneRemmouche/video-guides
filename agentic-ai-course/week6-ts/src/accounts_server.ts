// Port of 6_mcp/accounts_server.py — our own MCP server: 5 tools and 2 resources over stdio, wrapping accounts.ts.
// Differences: FastMCP's @mcp.tool() decorators become server.registerTool(name, {description, inputSchema}, handler)
// from the official TypeScript SDK (@modelcontextprotocol/server v2); the argument docs move into zod .describe() calls,
// and each handler returns MCP "content" (text) explicitly where FastMCP converts return values for you.
// Never console.log in a stdio server: stdout carries the protocol messages. (Errors thrown by a handler reach the
// client as a tool error, as FastMCP does with a raised ValueError.)
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { Account } from "./accounts.js";

const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value) }],
});

function createServer(): McpServer {
  const mcp = new McpServer({ name: "accounts_server", version: "1.0.0" });

  mcp.registerTool(
    "get_balance",
    {
      description: "Get the cash balance of the given account name.",
      inputSchema: z.object({ name: z.string().describe("The name of the account holder") }),
    },
    async ({ name }) => text(Account.get(name).balance),
  );

  mcp.registerTool(
    "get_holdings",
    {
      description: "Get the holdings of the given account name.",
      inputSchema: z.object({ name: z.string().describe("The name of the account holder") }),
    },
    async ({ name }) => text(Account.get(name).holdings),
  );

  mcp.registerTool(
    "buy_shares",
    {
      description: "Buy shares of a stock.",
      inputSchema: z.object({
        name: z.string().describe("The name of the account holder"),
        symbol: z.string().describe("The symbol of the stock"),
        quantity: z.number().int().describe("The quantity of shares to buy"),
        rationale: z.string().describe("The rationale for the purchase and fit with the account's strategy"),
      }),
    },
    async ({ name, symbol, quantity, rationale }) => text(await Account.get(name).buyShares(symbol, quantity, rationale)),
  );

  mcp.registerTool(
    "sell_shares",
    {
      description: "Sell shares of a stock.",
      inputSchema: z.object({
        name: z.string().describe("The name of the account holder"),
        symbol: z.string().describe("The symbol of the stock"),
        quantity: z.number().int().describe("The quantity of shares to sell"),
        rationale: z.string().describe("The rationale for the sale and fit with the account's strategy"),
      }),
    },
    async ({ name, symbol, quantity, rationale }) => text(await Account.get(name).sellShares(symbol, quantity, rationale)),
  );

  mcp.registerTool(
    "change_strategy",
    {
      description: "At your discretion, if you choose to, call this to change your investment strategy for the future.",
      inputSchema: z.object({
        name: z.string().describe("The name of the account holder"),
        strategy: z.string().describe("The new strategy for the account"),
      }),
    },
    async ({ name, strategy }) => text(Account.get(name).changeStrategy(strategy)),
  );

  // Resources: read-only context the client can fetch by URI (the {name} part is a template variable).
  mcp.registerResource(
    "read_account_resource",
    new ResourceTemplate("accounts://accounts_server/{name}", { list: undefined }),
    { mimeType: "text/plain" },
    async (uri, { name }) => ({ contents: [{ uri: uri.href, text: await Account.get(String(name).toLowerCase()).report() }] }),
  );

  mcp.registerResource(
    "read_strategy_resource",
    new ResourceTemplate("accounts://strategy/{name}", { list: undefined }),
    { mimeType: "text/plain" },
    async (uri, { name }) => ({ contents: [{ uri: uri.href, text: Account.get(String(name).toLowerCase()).getStrategy() }] }),
  );

  return mcp;
}

serveStdio(createServer); // mcp.run(transport='stdio')
