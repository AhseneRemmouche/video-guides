"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { PLATFORMS, type Platform } from "@/lib/db/schema";
import { destroySession, requireSession } from "@/lib/auth";
import { CAMPAIGN_COOKIE } from "@/lib/campaign";
import { cancelPost, handOffPost, setAutoPublish, syncStatuses } from "@/lib/publishing";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function createCampaign(formData: FormData) {
  await requireSession();
  const platforms = PLATFORMS.filter((p) => formData.get(`platform_${p}`) === "on");
  const [row] = await db
    .insert(schema.campaigns)
    .values({
      name: str(formData, "name") || "My campaign",
      niche: str(formData, "niche") || "general",
      audience: str(formData, "audience"),
      goal: str(formData, "goal"),
      tone: str(formData, "tone") || "friendly and clear",
      link: str(formData, "link"),
      platforms,
    })
    .returning({ id: schema.campaigns.id });
  (await cookies()).set(CAMPAIGN_COOKIE, row!.id, { path: "/", sameSite: "lax", maxAge: 365 * 24 * 3600 });
  redirect("/dashboard");
}

export async function updateCampaign(formData: FormData) {
  await requireSession();
  const id = str(formData, "id");
  const platforms = PLATFORMS.filter((p) => formData.get(`platform_${p}`) === "on");
  await db
    .update(schema.campaigns)
    .set({ name: str(formData, "name"), niche: str(formData, "niche"), audience: str(formData, "audience"), goal: str(formData, "goal"), tone: str(formData, "tone"), link: str(formData, "link"), platforms })
    .where(eq(schema.campaigns.id, id));
  revalidatePath("/dashboard", "layout");
}

export async function switchCampaign(formData: FormData) {
  await requireSession();
  (await cookies()).set(CAMPAIGN_COOKIE, str(formData, "id"), { path: "/", sameSite: "lax", maxAge: 365 * 24 * 3600 });
  revalidatePath("/dashboard", "layout");
}

export async function approvePost(formData: FormData) {
  await requireSession();
  await handOffPost(str(formData, "id"));
  revalidatePath("/dashboard", "layout");
}

export async function cancelPostAction(formData: FormData) {
  await requireSession();
  await cancelPost(str(formData, "id"));
  revalidatePath("/dashboard", "layout");
}

export async function deletePost(formData: FormData) {
  await requireSession();
  const id = str(formData, "id");
  const post = await db.query.posts.findFirst({ where: eq(schema.posts.id, id) });
  if (post && post.status !== "queued") await db.delete(schema.posts).where(eq(schema.posts.id, id));
  revalidatePath("/dashboard", "layout");
}

export async function createManualPost(formData: FormData) {
  await requireSession();
  const platform = str(formData, "platform") as Platform;
  if (!PLATFORMS.includes(platform)) return;
  const campaign = await db.query.campaigns.findFirst({ where: eq(schema.campaigns.id, str(formData, "campaignId")) });
  if (!campaign) return;
  const when = str(formData, "scheduledAt");
  await db.insert(schema.posts).values({
    campaignId: campaign.id,
    platform,
    title: str(formData, "title") || "Untitled post",
    body: str(formData, "body"),
    hashtags: str(formData, "hashtags").split(/[\s,]+/).filter((h) => h.startsWith("#")),
    imageUrl: str(formData, "imageUrl") || null,
    link: campaign.link,
    scheduledAt: when ? new Date(when) : null,
    status: when ? "awaiting_approval" : "draft",
  });
  revalidatePath("/dashboard", "layout");
}

export async function setAutoPublishAction(formData: FormData) {
  await requireSession();
  await setAutoPublish(formData.get("autoPublish") === "on");
  revalidatePath("/dashboard", "layout");
}

export async function refreshStatuses() {
  await requireSession();
  await syncStatuses();
  revalidatePath("/dashboard", "layout");
}

export async function signOut() {
  await destroySession();
  redirect("/signin");
}
