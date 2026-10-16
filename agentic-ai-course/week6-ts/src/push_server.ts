// Port of 6_mcp/push_server.py — an MCP server with one tool, push, that sends a Pushover notification.
// The input keeps the course's shape {args: {message}} (Python takes a Pydantic model named args).
// Differences: fetch replaces requests; without PUSHOVER_USER/PUSHOVER_TOKEN the message is only printed (to stderr,
// because stdout belongs to the MCP protocol).
import { config } from "dotenv";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";

config({ override: true, quiet: true });

const pushoverUser = process.env.PUSHOVER_USER;
const pushoverToken = process.env.PUSHOVER_TOKEN;
const pushoverUrl = "https://api.pushover.net/1/messages.json";

function createServer(): McpServer {
  const mcp = new McpServer({ name: "push_server", version: "1.0.0" });
  mcp.registerTool(
    "push",
    {
      description: "Send a push notification with this brief message",
      inputSchema: z.object({ args: z.object({ message: z.string().describe("A brief message to push") }) }),
    },
    async ({ args }) => {
      console.error(`Push: ${args.message}`);
      if (pushoverUser && pushoverToken) {
        await fetch(pushoverUrl, { method: "POST", body: new URLSearchParams({ user: pushoverUser, token: pushoverToken, message: args.message }) });
      }
      return { content: [{ type: "text", text: "Push notification sent" }] };
    },
  );
  return mcp;
}

serveStdio(createServer);
