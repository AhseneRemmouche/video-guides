import { cookies } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const CAMPAIGN_COOKIE = "socialix_campaign";

export async function listCampaigns() {
  return db.query.campaigns.findMany({ orderBy: desc(schema.campaigns.createdAt) });
}

/** The campaign chosen in the sidebar (cookie), or the newest one. */
export async function getCurrentCampaign() {
  const id = (await cookies()).get(CAMPAIGN_COOKIE)?.value;
  if (id) {
    const c = await db.query.campaigns.findFirst({ where: eq(schema.campaigns.id, id) });
    if (c) return c;
  }
  return (await db.query.campaigns.findFirst({ orderBy: desc(schema.campaigns.createdAt) })) ?? null;
}

export type Campaign = NonNullable<Awaited<ReturnType<typeof getCurrentCampaign>>>;
