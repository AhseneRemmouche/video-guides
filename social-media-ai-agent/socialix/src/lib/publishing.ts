import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { callSocialTool } from "@/lib/mcp/social";

/**
 * Publishing goes through the Social Publisher MCP server, which hands posts to the WordPress Social
 * Autopilot's queue. Nothing reaches a social network until a post is handed over here: either when the
 * owner clicks Approve, or automatically when the "auto-publish" setting is on.
 */

export async function getAutoPublish(): Promise<boolean> {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, "autoPublish") });
  return row?.value === true;
}

export async function setAutoPublish(value: boolean): Promise<void> {
  await db
    .insert(schema.settings)
    .values({ key: "autoPublish", value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
}

/** Hand one post to the autopilot. Returns a short message for the agent or the UI. */
export async function handOffPost(postId: string): Promise<{ ok: boolean; message: string }> {
  const post = await db.query.posts.findFirst({ where: eq(schema.posts.id, postId) });
  if (!post) return { ok: false, message: `No post ${postId}` };
  if (post.autopilotContentId) return { ok: true, message: "Already handed to the autopilot." };
  const campaign = await db.query.campaigns.findFirst({ where: eq(schema.campaigns.id, post.campaignId) });
  const link = post.link || campaign?.link;
  if (!link) {
    await db.update(schema.posts).set({ status: "failed", error: "The campaign has no link to point posts to.", updatedAt: new Date() }).where(eq(schema.posts.id, postId));
    return { ok: false, message: "The campaign has no link; set one in the campaign settings." };
  }

  const result = await callSocialTool("publish_post", {
    platform: post.platform,
    title: post.title,
    body: post.body,
    hashtags: post.hashtags,
    link,
    ...(post.imageUrl ? { imageUrl: post.imageUrl } : {}),
    ...(post.scheduledAt && post.scheduledAt > new Date() ? { scheduledAt: post.scheduledAt.toISOString() } : {}),
  });
  if (result.isError) {
    await db.update(schema.posts).set({ status: "failed", error: result.text, updatedAt: new Date() }).where(eq(schema.posts.id, postId));
    return { ok: false, message: result.text };
  }
  const contentId = (JSON.parse(result.text) as { contentId: string }).contentId;
  await db
    .update(schema.posts)
    .set({ status: "queued", autopilotContentId: contentId, error: null, updatedAt: new Date() })
    .where(eq(schema.posts.id, postId));
  return { ok: true, message: `Queued in the autopilot (content ${contentId}).` };
}

/** Ask the autopilot how queued posts are doing and copy the results into our posts table. */
export async function syncStatuses(campaignId?: string): Promise<number> {
  const queued = await db.query.posts.findMany({
    where: campaignId
      ? and(eq(schema.posts.campaignId, campaignId), inArray(schema.posts.status, ["queued"]))
      : inArray(schema.posts.status, ["queued"]),
  });
  let changed = 0;
  for (const post of queued) {
    if (!post.autopilotContentId) continue;
    const r = await callSocialTool("get_post_status", { contentId: post.autopilotContentId });
    if (r.isError) continue;
    const s = JSON.parse(r.text) as { status: string; lastError: string | null; url: string | null };
    if (s.status === "PUBLISHED") {
      await db.update(schema.posts).set({ status: "published", externalUrl: s.url, error: null, updatedAt: new Date() }).where(eq(schema.posts.id, post.id));
      changed++;
    } else if (s.status === "FAILED") {
      await db.update(schema.posts).set({ status: "failed", error: s.lastError, updatedAt: new Date() }).where(eq(schema.posts.id, post.id));
      changed++;
    }
  }
  return changed;
}

export async function cancelPost(postId: string): Promise<{ ok: boolean; message: string }> {
  const post = await db.query.posts.findFirst({ where: eq(schema.posts.id, postId) });
  if (!post) return { ok: false, message: "No such post" };
  if (post.autopilotContentId && post.status === "queued") {
    const r = await callSocialTool("cancel_post", { contentId: post.autopilotContentId });
    if (r.isError) return { ok: false, message: r.text };
  }
  await db.update(schema.posts).set({ status: "cancelled", updatedAt: new Date() }).where(eq(schema.posts.id, postId));
  return { ok: true, message: "Cancelled." };
}
