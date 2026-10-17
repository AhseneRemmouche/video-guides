import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, gte, lt } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db, schema } from "@/lib/db";
import { getCurrentCampaign } from "@/lib/campaign";
import { Card, PageHeader, PlatformBadge, StatusBadge } from "@/components/ui";

/** Week view of scheduled posts. ?week=N moves N weeks from the current one. */
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const campaign = await getCurrentCampaign();
  if (!campaign) redirect("/dashboard/campaigns/new");
  const offset = Number((await searchParams).week ?? 0) || 0;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + offset * 7); // Monday
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const posts = await db.query.posts.findMany({
    where: and(eq(schema.posts.campaignId, campaign.id), gte(schema.posts.scheduledAt, start), lt(schema.posts.scheduledAt, end)),
  });
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
  const today = new Date().toDateString();

  return (
    <>
      <PageHeader title="Calendar" subtitle="Plan when your content goes live">
        <div className="flex items-center gap-2">
          <Link href={`?week=${offset - 1}`} className="rounded-xl bg-white p-2 shadow-sm">
            <ChevronLeft size={16} />
          </Link>
          <Link href="?week=0" className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm">
            Today
          </Link>
          <Link href={`?week=${offset + 1}`} className="rounded-xl bg-white p-2 shadow-sm">
            <ChevronRight size={16} />
          </Link>
        </div>
      </PageHeader>
      <p className="mb-4 text-sm text-gray-500">
        {days[0]!.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {days[6]!.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {posts.length} posts
      </p>
      <div className="grid gap-3 md:grid-cols-7">
        {days.map((d) => {
          const dayPosts = posts.filter((p) => p.scheduledAt && p.scheduledAt.toDateString() === d.toDateString()).sort((a, b) => a.scheduledAt!.getTime() - b.scheduledAt!.getTime());
          return (
            <Card key={d.toISOString()} className={`min-h-48 p-3 ${d.toDateString() === today ? "ring-2 ring-brand-500" : ""}`}>
              <p className="text-xs font-semibold uppercase text-gray-400">{d.toLocaleDateString("en-US", { weekday: "short" })}</p>
              <p className="text-lg font-semibold">{d.getDate()}</p>
              <div className="mt-2 flex flex-col gap-2">
                {dayPosts.map((p) => (
                  <div key={p.id} className="rounded-xl border border-gray-100 p-2">
                    <div className="flex items-center gap-1.5">
                      <PlatformBadge platform={p.platform} size="sm" />
                      <span className="text-xs text-gray-500">{p.scheduledAt!.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs font-medium">{p.title}</p>
                    <div className="mt-1">
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
