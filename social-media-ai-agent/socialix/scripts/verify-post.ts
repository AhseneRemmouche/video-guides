// Test helper: prints a post's status in this app and, if it was handed off, in the autopilot (via MCP).
// Run: pnpm exec tsx scripts/verify-post.ts "<post title>"
import { desc, eq } from "drizzle-orm";
import { db, schema } from "../src/lib/db";
import { callSocialTool } from "../src/lib/mcp/social";

const title = process.argv[2] ?? "";
const post = await db.query.posts.findFirst({ where: eq(schema.posts.title, title), orderBy: desc(schema.posts.createdAt) });
if (!post) {
  console.log(JSON.stringify({ found: false }));
  process.exit(0);
}
const autopilot = post.autopilotContentId ? (await callSocialTool("get_post_status", { contentId: post.autopilotContentId })).text : null;
console.log(JSON.stringify({ found: true, status: post.status, scheduledAt: post.scheduledAt, handedOff: Boolean(post.autopilotContentId), autopilot }));
process.exit(0);
