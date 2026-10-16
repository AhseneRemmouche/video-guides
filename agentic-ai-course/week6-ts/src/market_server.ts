// Port of 6_mcp/market_server.py — an MCP server with one tool, lookup_share_price, wrapping market.ts.
// Without POLYGON_API_KEY the price comes from market.ts's labelled stand-in (fake prices), not from Polygon.
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { getSharePrice } from "./market.js";

function createServer(): McpServer {
  const mcp = new McpServer({ name: "market_server", version: "1.0.0" });
  mcp.registerTool(
    "lookup_share_price",
    {
      description: "This tool provides the current price of the given stock symbol.",
      inputSchema: z.object({ symbol: z.string().describe("the symbol of the stock") }),
    },
    async ({ symbol }) => ({ content: [{ type: "text", text: String(await getSharePrice(symbol)) }] }),
  );
  return mcp;
}

serveStdio(createServer);
