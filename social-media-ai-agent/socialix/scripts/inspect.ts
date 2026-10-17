// Development helper: prints the latest messages, tasks, posts and usage from this app's database.
import { desc } from "drizzle-orm";
import { db, schema } from "../src/lib/db";

const msgs = await db.query.agentMessages.findMany({ orderBy: desc(schema.agentMessages.createdAt), limit: 6 });
console.log("messages:", msgs.map((m) => `${m.agent}/${m.role}: ${m.content.slice(0, 300)}`));
const tasks = await db.query.agentTasks.findMany({ orderBy: desc(schema.agentTasks.createdAt), limit: 10 });
console.log("tasks:", tasks.map((t) => `${t.agent} [${t.status}] ${t.title} -> ${t.result.slice(0, 200)}`));
const posts = await db.query.posts.findMany({ orderBy: desc(schema.posts.createdAt), limit: 10 });
console.log("posts:", posts.map((p) => `${p.platform} [${p.status}] ${p.title} @ ${p.scheduledAt?.toISOString() ?? "-"}`));
const usage = await db.query.usage.findMany({ orderBy: desc(schema.usage.createdAt), limit: 40 });
console.log("usage rows:", usage.length, usage.slice(0, 10).map((u) => `${u.agent} ${u.model} in=${u.inputTokens} out=${u.outputTokens} s=${u.webSearches} ${u.createdAt.toISOString()}`));
process.exit(0);
