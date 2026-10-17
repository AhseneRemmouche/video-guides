import { NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { AGENTS, type AgentRole } from "@/lib/db/schema";
import { isRunning } from "@/lib/ai/runner";

/**
 * Everything the AI Agent page shows, in one poll: each agent's status, the chosen agent's messages and the
 * task board. GET /api/agents/state?campaignId=...&agent=master
 */
export async function GET(req: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaignId") ?? "";
  const agent = (url.searchParams.get("agent") ?? "master") as AgentRole;
  if (!campaignId || !AGENTS.includes(agent)) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const [messages, tasks] = await Promise.all([
    db.query.agentMessages.findMany({
      where: and(eq(schema.agentMessages.campaignId, campaignId), eq(schema.agentMessages.agent, agent)),
      orderBy: asc(schema.agentMessages.createdAt),
    }),
    db.query.agentTasks.findMany({ where: eq(schema.agentTasks.campaignId, campaignId), orderBy: desc(schema.agentTasks.createdAt), limit: 30 }),
  ]);

  const status = Object.fromEntries(
    AGENTS.map((a) => {
      const latest = tasks.find((t) => t.agent === a);
      const working = isRunning(campaignId, a) || tasks.some((t) => t.agent === a && t.status === "running");
      return [a, working ? "running" : latest?.status === "done" ? "done" : latest?.status === "failed" ? "failed" : "idle"];
    }),
  );

  return NextResponse.json({
    status,
    thinking: isRunning(campaignId, agent),
    messages: messages.map((m) => ({ id: m.id, role: m.role, content: m.content, at: m.createdAt })),
    tasks: tasks.map((t) => ({ id: t.id, agent: t.agent, title: t.title, status: t.status, result: t.result, at: t.createdAt })),
  });
}
