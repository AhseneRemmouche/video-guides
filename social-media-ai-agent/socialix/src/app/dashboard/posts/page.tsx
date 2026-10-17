import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { PLATFORMS, type PostStatus } from "@/lib/db/schema";
import { getCurrentCampaign } from "@/lib/campaign";
import { getAutoPublish } from "@/lib/publishing";
import { Card, PageHeader, PLATFORM_LABEL, PlatformBadge, StatusBadge, formatWhen } from "@/components/ui";
import { approvePost, cancelPostAction, createManualPost, deletePost, refreshStatuses } from "../actions";

const TABS: { key: string; label: string; statuses: PostStatus[] }[] = [
  { key: "all", label: "All", statuses: ["draft", "awaiting_approval", "queued", "published", "failed", "cancelled"] },
  { key: "approval", label: "Awaiting approval", statuses: ["awaiting_approval"] },
  { key: "drafts", label: "Drafts", statuses: ["draft"] },
  { key: "queued", label: "Queued", statuses: ["queued"] },
  { key: "published", label: "Published", statuses: ["published"] },
  { key: "failed", label: "Failed", statuses: ["failed", "cancelled"] },
];

export default async function PostsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const campaign = await getCurrentCampaign();
  if (!campaign) redirect("/dashboard/campaigns/new");
  const { tab = "all" } = await searchParams;
  const all = await db.query.posts.findMany({ where: eq(schema.posts.campaignId, campaign.id), orderBy: desc(schema.posts.createdAt) });
  const active = TABS.find((t) => t.key === tab) ?? TABS[0]!;
  const shown = all.filter((p) => active.statuses.includes(p.status));
  const autoPublish = await getAutoPublish();

  return (
    <>
      <PageHeader title="Posts" subtitle="Drafts, scheduled and published content">
        <form action={refreshStatuses}>
          <button className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm">Refresh statuses</button>
        </form>
      </PageHeader>

      {!autoPublish && (
        <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Auto-publish is off: nothing is posted until you press <strong>Approve</strong>. Approved posts go to the WordPress Social Autopilot&apos;s queue and are published by its worker at their scheduled time.
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <a key={t.key} href={`?tab=${t.key}`} className={`rounded-full px-3 py-1.5 text-sm ${t.key === active.key ? "bg-gray-900 text-white" : "bg-white text-gray-600"}`}>
            {t.label} <span className="opacity-60">{all.filter((p) => t.statuses.includes(p.status)).length}</span>
          </a>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((p) => (
          <Card key={p.id} className="flex flex-col gap-3">
            {p.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt="" className="aspect-video w-full rounded-2xl object-cover" />
            )}
            <div className="flex items-center gap-2">
              <PlatformBadge platform={p.platform} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.title}</span>
              <StatusBadge status={p.status} />
            </div>
            <p className="line-clamp-6 whitespace-pre-wrap text-sm text-gray-700">{p.body}</p>
            {p.hashtags.length > 0 && <p className="text-sm text-brand-600">{p.hashtags.join(" ")}</p>}
            <p className="text-xs text-gray-500">{formatWhen(p.scheduledAt)}</p>
            {p.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{p.error}</p>}
            {p.externalUrl && (
              <a href={p.externalUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-600 underline">
                View the live post
              </a>
            )}
            <div className="mt-auto flex flex-wrap gap-2">
              {(p.status === "draft" || p.status === "awaiting_approval" || p.status === "failed") && (
                <form action={approvePost}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white">{p.scheduledAt ? "Approve" : "Approve & publish now"}</button>
                </form>
              )}
              {p.status === "queued" && (
                <form action={cancelPostAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs">Cancel</button>
                </form>
              )}
              {p.status !== "queued" && (
                <form action={deletePost}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:text-red-600">Delete</button>
                </form>
              )}
            </div>
          </Card>
        ))}
        {shown.length === 0 && <p className="col-span-full py-10 text-center text-sm text-gray-400">Nothing here yet.</p>}
      </div>

      <Card className="mt-8">
        <h2 className="font-semibold">Create a post yourself</h2>
        <form action={createManualPost} className="mt-4 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="campaignId" value={campaign.id} />
          <select name="platform" className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
              </option>
            ))}
          </select>
          <input name="title" placeholder="Title" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          <textarea name="body" required placeholder="Post text" rows={4} className="rounded-xl border border-gray-200 px-3 py-2 text-sm md:col-span-2" />
          <input name="hashtags" placeholder="#hashtags separated by spaces" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          <input name="imageUrl" type="url" placeholder="Image URL (needed for Instagram and TikTok)" className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          <label className="text-sm text-gray-600">
            Publish at (optional)
            <input name="scheduledAt" type="datetime-local" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          </label>
          <button className="self-end rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white">Save</button>
        </form>
      </Card>
    </>
  );
}
