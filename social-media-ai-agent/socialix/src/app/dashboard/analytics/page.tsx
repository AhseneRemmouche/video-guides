import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { PLATFORMS, type PostStatus } from "@/lib/db/schema";
import { getCurrentCampaign } from "@/lib/campaign";
import { syncStatuses } from "@/lib/publishing";
import { Card, PageHeader, PLATFORM_LABEL, PlatformBadge } from "@/components/ui";

const STATUSES: PostStatus[] = ["draft", "awaiting_approval", "queued", "published", "failed"];

export default async function AnalyticsPage() {
  const campaign = await getCurrentCampaign();
  if (!campaign) redirect("/dashboard/campaigns/new");
  await syncStatuses(campaign.id).catch(() => 0);
  const posts = await db.query.posts.findMany({ where: eq(schema.posts.campaignId, campaign.id) });
  const usage = await db
    .select({
      agent: schema.usage.agent,
      calls: sql<number>`count(*)::int`,
      input: sql<number>`coalesce(sum(${schema.usage.inputTokens}),0)::int`,
      output: sql<number>`coalesce(sum(${schema.usage.outputTokens}),0)::int`,
      searches: sql<number>`coalesce(sum(${schema.usage.webSearches}),0)::int`,
    })
    .from(schema.usage)
    .groupBy(schema.usage.agent);

  const max = Math.max(1, ...PLATFORMS.map((p) => posts.filter((x) => x.platform === p).length));

  return (
    <>
      <PageHeader title="Analytics" subtitle="What your team produced and published" />
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {STATUSES.map((s) => (
          <Card key={s}>
            <p className="text-sm capitalize text-gray-500">{s.replace("_", " ")}</p>
            <p className="mt-1 text-3xl font-semibold">{posts.filter((p) => p.status === s).length}</p>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">Posts per platform</h2>
          <div className="space-y-3">
            {PLATFORMS.map((p) => {
              const total = posts.filter((x) => x.platform === p).length;
              const done = posts.filter((x) => x.platform === p && x.status === "published").length;
              return (
                <div key={p} className="flex items-center gap-3">
                  <PlatformBadge platform={p} size="sm" />
                  <span className="w-20 text-sm">{PLATFORM_LABEL[p]}</span>
                  <div className="h-3 flex-1 rounded-full bg-gray-100">
                    <div className="h-3 rounded-full bg-brand-500" style={{ width: `${(total / max) * 100}%` }} />
                  </div>
                  <span className="w-16 text-right text-xs text-gray-500">
                    {done}/{total} live
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <h2 className="mb-1 font-semibold">Claude usage by agent</h2>
          <p className="mb-4 text-xs text-gray-500">All campaigns. Tokens are what Anthropic bills; web searches are billed separately.</p>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-400">
              <tr>
                <th className="pb-2">Agent</th>
                <th className="pb-2 text-right">Calls</th>
                <th className="pb-2 text-right">Input tokens</th>
                <th className="pb-2 text-right">Output tokens</th>
                <th className="pb-2 text-right">Searches</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((u) => (
                <tr key={u.agent} className="border-t border-gray-100">
                  <td className="py-2 capitalize">{u.agent}</td>
                  <td className="py-2 text-right">{u.calls}</td>
                  <td className="py-2 text-right">{u.input.toLocaleString()}</td>
                  <td className="py-2 text-right">{u.output.toLocaleString()}</td>
                  <td className="py-2 text-right">{u.searches}</td>
                </tr>
              ))}
              {usage.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400">
                    No agent calls yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
      <p className="mt-6 text-xs text-gray-400">Engagement numbers (likes, reach) are not collected yet: the autopilot publishes posts but does not read their metrics.</p>
    </>
  );
}
