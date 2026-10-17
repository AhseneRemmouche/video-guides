import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { CalendarClock, Link2, Send } from "lucide-react";
import { db, schema } from "@/lib/db";
import type { AgentRole } from "@/lib/db/schema";
import { getCurrentCampaign } from "@/lib/campaign";
import { callSocialTool } from "@/lib/mcp/social";
import { Office } from "@/components/office";
import { Card, PageHeader, PlatformBadge, StatusBadge, formatWhen } from "@/components/ui";

export default async function Overview() {
  const campaign = await getCurrentCampaign();
  if (!campaign) redirect("/dashboard/campaigns/new");

  const [posts, tasks, connections] = await Promise.all([
    db.query.posts.findMany({ where: eq(schema.posts.campaignId, campaign.id), orderBy: asc(schema.posts.scheduledAt) }),
    db.query.agentTasks.findMany({ where: eq(schema.agentTasks.campaignId, campaign.id), orderBy: desc(schema.agentTasks.createdAt), limit: 6 }),
    callSocialTool("list_connections", {}).then((r) => (r.isError ? [] : (JSON.parse(r.text) as { platform: string; status: string }[]))).catch(() => []),
  ]);
  const running = await db.query.agentTasks.findMany({ where: and(eq(schema.agentTasks.campaignId, campaign.id), inArray(schema.agentTasks.status, ["running"])) });

  const upcoming = posts.filter((p) => p.scheduledAt && ["awaiting_approval", "queued"].includes(p.status)).slice(0, 5);
  const published = posts.filter((p) => p.status === "published").length;
  const done = posts.filter((p) => p.status === "published").length;
  const progress = posts.length ? Math.round((done / posts.length) * 100) : 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const stats = [
    { label: "Scheduled posts", value: upcoming.length, note: upcoming.length ? "Waiting to go out" : "Nothing queued yet", icon: CalendarClock },
    { label: "Published", value: published, note: "In this campaign", icon: Send },
    { label: "Connected accounts", value: connections.filter((c) => c.status === "CONNECTED").length, note: "Through the autopilot", icon: Link2 },
  ];

  return (
    <>
      <PageHeader title="Overview" subtitle="A snapshot of your campaign at a glance">
        <Link href="/dashboard/ai-agent" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Brief the team
        </Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-sm text-gray-500">{greeting} 👋</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">Your AI creative team is on it.</h2>
            <p className="mt-2 text-gray-500">From trends to content to posting, your agents work together to turn ideas into real growth.</p>
          </div>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{campaign.name}</p>
                <p className="text-sm text-gray-500">{campaign.niche}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold">{progress}%</p>
                <p className="text-xs text-gray-500">published</p>
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-gray-100">
              <div className="h-2 rounded-full bg-brand-600" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {done} of {posts.length} posts published
            </p>
          </Card>
          <div className="grid gap-4 sm:grid-cols-3">
            {stats.map(({ label, value, note, icon: Icon }) => (
              <Card key={label}>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  {label}
                  <Icon size={16} className="text-brand-600" />
                </div>
                <p className="mt-2 text-3xl font-semibold">{value}</p>
                <p className="text-xs text-gray-400">{note}</p>
              </Card>
            ))}
          </div>
        </div>
        <Office working={running.map((t) => t.agent as AgentRole)} className="aspect-[10/7]" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Upcoming posts</h3>
            <Link href="/dashboard/calendar" className="text-sm text-brand-600">
              View calendar →
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No posts scheduled yet. Ask the Master Agent to plan some.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {upcoming.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <PlatformBadge platform={p.platform} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    <p className="text-xs text-gray-500">{formatWhen(p.scheduledAt)}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h3 className="mb-3 font-semibold">Recent activity</h3>
          {tasks.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">As your AI agents research, write and publish, their updates will appear here.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium capitalize">{t.agent}</span> · {t.title}
                  </span>
                  <span className={`text-xs ${t.status === "done" ? "text-emerald-600" : t.status === "failed" ? "text-red-600" : "text-brand-600"}`}>{t.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
