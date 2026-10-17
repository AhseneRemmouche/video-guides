import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { db, schema } from "@/lib/db";
import type { AgentRole, Platform } from "@/lib/db/schema";
import { PLATFORMS } from "@/lib/db/schema";
import { config } from "@/lib/env";
import { callSocialTool } from "@/lib/mcp/social";
import { getAutoPublish, handOffPost, syncStatuses } from "@/lib/publishing";

/** Everything a tool needs to know about the call it is part of. */
export type ToolContext = {
  campaignId: string;
  /** Lets the Master Agent run a team member (provided by the runner, avoids a circular import). */
  runSubAgent: (agent: AgentRole, instructions: string, taskId: string) => Promise<string>;
};

export type AgentTool = {
  definition: Anthropic.Messages.ToolUnion;
  /** Absent for server tools (web search), which Anthropic runs itself. */
  run?: (input: unknown, ctx: ToolContext) => Promise<string>;
};

/** A client tool from a zod schema: the schema is both the JSON schema Claude sees and the input validator. */
function tool<S extends z.ZodObject>(name: string, description: string, input: S, run: (args: z.infer<S>, ctx: ToolContext) => Promise<unknown>): AgentTool {
  return {
    definition: { name, description, input_schema: z.toJSONSchema(input) as Anthropic.Tool.InputSchema },
    run: async (raw, ctx) => {
      const parsed = input.safeParse(raw);
      if (!parsed.success) return `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`;
      const out = await run(parsed.data, ctx);
      return typeof out === "string" ? out : JSON.stringify(out, null, 2);
    },
  };
}

const CHAR_LIMITS: Record<Platform, number> = { LINKEDIN: 3000, FACEBOOK: 500, INSTAGRAM: 2200, X: 280, TIKTOK: 2200, YOUTUBE: 5000 };

// ---------- Research ----------

const webSearch: AgentTool = {
  definition: { type: "web_search_20250305", name: "web_search", max_uses: 5 },
};

const saveResearch = tool(
  "save_research",
  "Save one research finding for the team (the Creator Agent reads these).",
  z.object({
    title: z.string().describe("A short title for the finding"),
    summary: z.string().describe("What was found and why it matters for the campaign, a few sentences"),
    sources: z.array(z.object({ title: z.string(), url: z.string().url() })).describe("The web pages it came from"),
  }),
  async ({ title, summary, sources }, ctx) => {
    await db.insert(schema.research).values({ campaignId: ctx.campaignId, title, summary, sources });
    return `Saved research: ${title}`;
  },
);

const wordpressRecentPosts = tool(
  "wordpress_recent_posts",
  "Read the most recent articles published on the owner's WordPress site (title, link, excerpt). Read-only.",
  z.object({ count: z.number().int().min(1).max(10).default(5) }),
  async ({ count }) => {
    if (!config.wordpressSiteUrl) return "No WordPress site is configured.";
    const url = new URL("/wp-json/wp/v2/posts", config.wordpressSiteUrl);
    url.searchParams.set("per_page", String(count));
    url.searchParams.set("_fields", "title,link,excerpt,date");
    // Some sites sit behind a bot filter that rejects unknown clients, so identify as a regular browser.
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36" },
    });
    if (!res.ok) return `WordPress returned HTTP ${res.status} (the site may block automated requests to its REST API).`;
    const items = (await res.json()) as { title: { rendered: string }; link: string; excerpt: { rendered: string }; date: string }[];
    const strip = (html: string) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    return items.map((p) => ({ title: strip(p.title.rendered), link: p.link, date: p.date, excerpt: strip(p.excerpt.rendered).slice(0, 300) }));
  },
);

// ---------- Creator ----------

const listResearch = tool(
  "list_research",
  "List the research findings saved for this campaign, newest first.",
  z.object({ limit: z.number().int().min(1).max(20).default(10) }),
  async ({ limit }, ctx) => {
    const rows = await db.query.research.findMany({ where: eq(schema.research.campaignId, ctx.campaignId), orderBy: desc(schema.research.createdAt), limit });
    return rows.length ? rows.map(({ title, summary, sources }) => ({ title, summary, sources })) : "No research saved yet.";
  },
);

const saveDraft = tool(
  "save_draft",
  "Save a finished post as a draft for one platform.",
  z.object({
    platform: z.enum(PLATFORMS),
    title: z.string().describe("A short working title"),
    body: z.string().describe("The post text, ready to publish, without hashtags"),
    hashtags: z.array(z.string()).default([]).describe("Hashtags, each starting with #"),
    imageUrl: z.string().url().optional().describe("A real public image URL (required for Instagram and TikTok)"),
  }),
  async ({ platform, title, body, hashtags, imageUrl }, ctx) => {
    const campaign = await db.query.campaigns.findFirst({ where: eq(schema.campaigns.id, ctx.campaignId) });
    // The autopilot appends the link and the hashtags; count them so the post is never cut when published.
    const total = (hashtags.length ? `${body}\n\n${hashtags.join(" ")}` : body).length + (campaign?.link ? campaign.link.length + 1 : 0);
    if (total > CHAR_LIMITS[platform]) {
      return `Not saved: with hashtags and the link it is ${total} characters, but ${platform} allows ${CHAR_LIMITS[platform]}. Shorten it by at least ${total - CHAR_LIMITS[platform]} characters and call save_draft again.`;
    }
    const [row] = await db
      .insert(schema.posts)
      .values({ campaignId: ctx.campaignId, platform, title, body, hashtags, imageUrl: imageUrl ?? null, link: campaign?.link ?? "" })
      .returning({ id: schema.posts.id });
    const media = (platform === "INSTAGRAM" || platform === "TIKTOK") && !imageUrl ? ` Note: ${platform} needs an image before it can be published.` : "";
    return `Saved draft ${row!.id} for ${platform} (${total}/${CHAR_LIMITS[platform]} characters).${media}`;
  },
);

// ---------- Scheduler ----------

const listConnections = tool("list_connections", "List the connected social accounts (from the WordPress Social Autopilot).", z.object({}), async () => (await callSocialTool("list_connections", {})).text);

const listDrafts = tool("list_drafts", "List this campaign's drafts that are not scheduled yet.", z.object({}), async (_args, ctx) => {
  const rows = await db.query.posts.findMany({ where: and(eq(schema.posts.campaignId, ctx.campaignId), eq(schema.posts.status, "draft")), orderBy: desc(schema.posts.createdAt) });
  return rows.length ? rows.map((p) => ({ postId: p.id, platform: p.platform, title: p.title, hasImage: Boolean(p.imageUrl) })) : "No drafts waiting.";
});

const schedulePost = tool(
  "schedule_post",
  "Schedule a draft at a time (ISO 8601 with time zone). With auto-publish on it goes straight to the autopilot's queue; otherwise it waits for the owner's approval.",
  z.object({ postId: z.string(), scheduledAt: z.string().datetime({ offset: true }) }),
  async ({ postId, scheduledAt }, ctx) => {
    const when = new Date(scheduledAt);
    if (when.getTime() < Date.now() - 60_000) return "That time is in the past; pick a future time.";
    const post = await db.query.posts.findFirst({ where: and(eq(schema.posts.id, postId), eq(schema.posts.campaignId, ctx.campaignId)) });
    if (!post) return `No draft ${postId} in this campaign.`;
    await db.update(schema.posts).set({ scheduledAt: when, status: "awaiting_approval", updatedAt: new Date() }).where(eq(schema.posts.id, postId));
    if (!(await getAutoPublish())) return `Scheduled ${post.platform} post for ${when.toISOString()}; waiting for the owner's approval (auto-publish is off).`;
    const r = await handOffPost(postId);
    return r.ok ? `Scheduled ${post.platform} post for ${when.toISOString()} and queued it in the autopilot. ${r.message}` : `Scheduling failed: ${r.message}`;
  },
);

// ---------- Analytics ----------

const postOverview = tool("post_overview", "Refresh publishing statuses from the autopilot, then list every post of this campaign with its status.", z.object({}), async (_args, ctx) => {
  await syncStatuses(ctx.campaignId);
  const rows = await db.query.posts.findMany({ where: eq(schema.posts.campaignId, ctx.campaignId), orderBy: desc(schema.posts.createdAt) });
  return rows.map((p) => ({ platform: p.platform, title: p.title, status: p.status, scheduledAt: p.scheduledAt, url: p.externalUrl, error: p.error }));
});

// ---------- Master ----------

const assignTask = tool(
  "assign_task",
  "Give a task to a team member and wait for the result. Include everything they need in the instructions (they do not see this conversation).",
  z.object({
    agent: z.enum(["research", "creator", "scheduler", "analytics"]),
    title: z.string().describe("A short task title, shown on the task board"),
    instructions: z.string().describe("Clear, complete instructions, including results from earlier tasks"),
  }),
  async ({ agent, title, instructions }, ctx) => {
    const [task] = await db.insert(schema.agentTasks).values({ campaignId: ctx.campaignId, agent, title, instructions, status: "running" }).returning({ id: schema.agentTasks.id });
    try {
      const result = await ctx.runSubAgent(agent, instructions, task!.id);
      await db.update(schema.agentTasks).set({ status: "done", result, updatedAt: new Date() }).where(eq(schema.agentTasks.id, task!.id));
      return `${agent} finished "${title}":\n${result}`;
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown error";
      await db.update(schema.agentTasks).set({ status: "failed", result: message, updatedAt: new Date() }).where(eq(schema.agentTasks.id, task!.id));
      return `${agent} failed "${title}": ${message}`;
    }
  },
);

const listTasks = tool("list_tasks", "List recent tasks and their status for this campaign.", z.object({}), async (_args, ctx) => {
  const rows = await db.query.agentTasks.findMany({ where: eq(schema.agentTasks.campaignId, ctx.campaignId), orderBy: desc(schema.agentTasks.createdAt), limit: 15 });
  return rows.map((t) => ({ agent: t.agent, title: t.title, status: t.status }));
});

export const TOOLS: Record<AgentRole, AgentTool[]> = {
  master: [assignTask, listTasks],
  research: [webSearch, saveResearch, wordpressRecentPosts],
  creator: [listResearch, saveDraft],
  scheduler: [listConnections, listDrafts, schedulePost],
  analytics: [postOverview],
};

export const _unused = inArray; // reserved for future status filters
