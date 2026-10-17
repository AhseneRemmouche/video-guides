// One cheap agent call to check the Claude key, the model names and the tool loop.
// Run: pnpm exec tsx scripts/agent-check.ts [agent] ["message"]
import { desc } from "drizzle-orm";
import { db, schema } from "../src/lib/db";
import type { AgentRole } from "../src/lib/db/schema";
import { runAgent } from "../src/lib/ai/runner";

const agent = (process.argv[2] ?? "analytics") as AgentRole;
const message = process.argv[3] ?? "Give me a short status report on the campaign's posts.";
const campaign = await db.query.campaigns.findFirst({ orderBy: desc(schema.campaigns.createdAt) });
if (!campaign) throw new Error("Create a campaign first");
const started = Date.now();
const reply = await runAgent(agent, campaign.id, [{ role: "user", content: message }]);
console.log(`${agent} replied in ${((Date.now() - started) / 1000).toFixed(1)} s:\n${reply}`);
process.exit(0);
