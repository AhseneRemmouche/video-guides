// Checks the Social Publisher MCP server without posting anything: lists its tools, the connected
// accounts and recent Socialix posts. Run: pnpm mcp:check
import { callSocialTool, socialMcp } from "../src/lib/mcp/social";

const client = await socialMcp();
const { tools } = await client.listTools();
console.log("tools:", tools.map((t) => t.name).join(", "));

const connections = await callSocialTool("list_connections", {});
console.log("\nlist_connections:\n" + connections.text);

const recent = await callSocialTool("list_recent_posts", { limit: 5 });
console.log("\nlist_recent_posts:\n" + recent.text);

const bad = await callSocialTool("publish_post", { platform: "INSTAGRAM", title: "check", body: "check", link: "https://example.com" });
console.log("\npublish_post without an image (must be refused, nothing queued):\n" + bad.text, bad.isError ? "(error, as expected)" : "");

await client.close();
process.exit(0);
