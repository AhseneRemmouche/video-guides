// An MCP server that offers the library catalog to any MCP client. Run: pnpm mcp-server
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { CATALOG, findItems } from "./catalog.js";

// The same logic as plain functions, so tests can call them without starting a server.
export function searchCatalog(query: string): string {
  const hits = findItems(query).slice(0, 5);
  return hits.map((b) => `${b.id}: ${b.title} by ${b.author}`).join("\n") || `No items match '${query}'.`;
}

export function checkAvailability(itemId: string): string {
  const b = CATALOG[itemId.trim().toUpperCase()];
  return b ? `${b.title}: ${b.available} of ${b.copies} available at ${b.branch}.` : `No item ${itemId}.`;
}

export function genres(): string {
  return [...new Set(Object.values(CATALOG).map((b) => b.genre))].sort().join(", ");
}

export function createServer(): McpServer {
  const server = new McpServer({ name: "harbor-catalog", version: "0.1.0" });
  server.registerTool(
    "search_catalog",
    {
      description: "Search the Harbor City Library catalog by words in the title, author or genre.",
      inputSchema: { query: z.string() },
    },
    async ({ query }) => ({ content: [{ type: "text", text: searchCatalog(query) }] }),
  );
  server.registerTool(
    "check_availability",
    {
      description: "How many copies of an item (id like B004) are on the shelf, and where.",
      inputSchema: { item_id: z.string() },
    },
    async ({ item_id }) => ({ content: [{ type: "text", text: checkAvailability(item_id) }] }),
  );
  server.registerResource(
    "genres",
    "catalog://genres",
    { description: "The list of genres in the catalog.", mimeType: "text/plain" },
    async (uri) => ({ contents: [{ uri: uri.href, text: genres() }] }),
  );
  return server;
}

// Start over stdio only when this file is run directly, not when a test imports it.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await createServer().connect(new StdioServerTransport());
}
