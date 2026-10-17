// Social Publisher MCP server (stdio). This replaces Blotato from the video.
//
// It does NOT talk to the social networks itself and never reads access tokens. It hands posts to the
// WordPress Social Autopilot: each post becomes a WordPressPost + an APPROVED GeneratedContent + a QUEUED
// PublishJob in the autopilot's database, exactly the rows its own code creates. The autopilot's worker
// (`npm run worker` in that project) then publishes them with its tested publishers: token refresh,
// three retries with backoff, and audit logs included. A future `scheduledAt` becomes the job's nextRunAt.
//
// Tools: list_connections, publish_post, get_post_status, cancel_post, list_recent_posts.
// Never write to stdout from this process except through the MCP transport (stdout carries the protocol).
import crypto from "node:crypto";
import pg from "pg";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from "../../src/lib/env";

const pool = new pg.Pool({ connectionString: config.autopilotDatabaseUrl, max: 3 });

const PLATFORMS = ["LINKEDIN", "FACEBOOK", "INSTAGRAM", "X", "TIKTOK", "YOUTUBE"] as const;
// Mirrors the autopilot's publisher capabilities (src/lib/publishers/*.ts) and character limits (src/lib/limits.ts).
const CAPABILITIES: Record<(typeof PLATFORMS)[number], { canAutoPublish: boolean; requiresMedia: boolean; charLimit: number }> = {
  LINKEDIN: { canAutoPublish: true, requiresMedia: false, charLimit: 3000 },
  FACEBOOK: { canAutoPublish: true, requiresMedia: false, charLimit: 500 },
  INSTAGRAM: { canAutoPublish: true, requiresMedia: true, charLimit: 2200 },
  X: { canAutoPublish: true, requiresMedia: false, charLimit: 280 },
  TIKTOK: { canAutoPublish: true, requiresMedia: true, charLimit: 2200 },
  YOUTUBE: { canAutoPublish: false, requiresMedia: false, charLimit: 5000 },
};

/** A cuid-like id (Prisma's cuid() default is applied client-side, so we must supply one). */
const newId = () => "c" + crypto.randomBytes(16).toString("hex").slice(0, 24);

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] });
const fail = (message: string) => ({ content: [{ type: "text" as const, text: message }], isError: true });

/** The autopilot stores timestamps as UTC in "timestamp without time zone" (Prisma's convention). */
const UTC_NOW = `(now() at time zone 'utc')`;

function postUrl(platform: string, externalId: string | null): string | null {
  if (!externalId) return null;
  if (platform === "FACEBOOK") return `https://www.facebook.com/${externalId}`;
  if (platform === "LINKEDIN") return `https://www.linkedin.com/feed/update/${externalId}`;
  if (platform === "X") return `https://x.com/i/web/status/${externalId}`;
  return null;
}

const server = new McpServer({ name: "social_publisher", version: "1.0.0" });

server.registerTool(
  "list_connections",
  {
    description:
      "List the social media accounts connected in the WordPress Social Autopilot, with their status (CONNECTED, TOKEN_EXPIRED, DISCONNECTED), whether each network needs an image, its character limit, and whether it can be published automatically.",
    inputSchema: {},
  },
  async () => {
    const r = await pool.query(`select platform::text as platform, status::text as status from "PlatformAccount"`);
    const byPlatform = new Map(r.rows.map((row: { platform: string; status: string }) => [row.platform, row.status]));
    return text(
      PLATFORMS.map((p) => ({
        platform: p,
        status: byPlatform.get(p) ?? "DISCONNECTED",
        ...CAPABILITIES[p],
      })),
    );
  },
);

server.registerTool(
  "publish_post",
  {
    description:
      "Queue a post for publishing through the WordPress Social Autopilot. It is published by the autopilot's worker at scheduledAt (ISO 8601) or as soon as possible if omitted. Instagram and TikTok need an imageUrl. Returns the autopilot content id to check later with get_post_status.",
    inputSchema: {
      platform: z.enum(PLATFORMS).describe("The social network"),
      title: z.string().min(1).describe("A short working title (shown in the autopilot dashboard)"),
      body: z.string().min(1).describe("The post text, without hashtags"),
      hashtags: z.array(z.string()).default([]).describe("Hashtags, each starting with #"),
      link: z.string().url().describe("The URL the post links back to (always kept, even when the text is shortened)"),
      imageUrl: z.string().url().optional().describe("A public image URL (required for Instagram and TikTok)"),
      scheduledAt: z.string().datetime({ offset: true }).optional().describe("When to publish, ISO 8601 with time zone"),
    },
  },
  async ({ platform, title, body, hashtags, link, imageUrl, scheduledAt }) => {
    const caps = CAPABILITIES[platform];
    if (!caps.canAutoPublish) return fail(`${platform} cannot be published automatically by the autopilot (manual posting only).`);
    if (caps.requiresMedia && !imageUrl) return fail(`${platform} needs an imageUrl.`);
    const account = await pool.query(`select status::text as status from "PlatformAccount" where platform = $1`, [platform]);
    const status = account.rows[0]?.status ?? "DISCONNECTED";
    if (status !== "CONNECTED") return fail(`${platform} is not connected in the autopilot (status ${status}). Reconnect it there first.`);

    const runAt = scheduledAt ? new Date(scheduledAt) : new Date();
    if (Number.isNaN(runAt.getTime())) return fail("scheduledAt is not a valid date.");
    const composedLength = (hashtags.length ? `${body}\n\n${hashtags.join(" ")}` : body).length;

    const client = await pool.connect();
    try {
      await client.query("begin");
      const postId = newId();
      const contentId = newId();
      const jobId = newId();
      // generatedAt is set so the autopilot's generation pass leaves this post alone.
      await client.query(
        `insert into "WordPressPost" (id, "wpPostId", title, content, excerpt, "featuredImageUrl", url, categories, tags, "sourceComplete", "receivedAt", "generatedAt")
         values ($1, $2, $3, $4, '', $5, $6, '{}', '{}', true, ${UTC_NOW}, ${UTC_NOW})`,
        [postId, `socialix-${postId}`, title, body, imageUrl ?? null, link],
      );
      await client.query(
        `insert into "GeneratedContent" (id, "postId", platform, body, hashtags, link, "charCount", status, "createdAt", "updatedAt")
         values ($1, $2, $3::"Platform", $4, $5, $6, $7, 'APPROVED'::"ContentStatus", ${UTC_NOW}, ${UTC_NOW})`,
        [contentId, postId, platform, body, hashtags, link, Math.min(composedLength, caps.charLimit)],
      );
      await client.query(
        `insert into "PublishJob" (id, "contentId", status, attempts, "maxAttempts", "nextRunAt", "createdAt", "updatedAt")
         values ($1, $2, 'QUEUED'::"JobStatus", 0, 3, ($3::timestamptz at time zone 'utc'), ${UTC_NOW}, ${UTC_NOW})`,
        [jobId, contentId, runAt.toISOString()],
      );
      await client.query("commit");
      return text({
        queued: true,
        contentId,
        platform,
        publishAt: runAt.toISOString(),
        note: "The autopilot worker must be running (npm run worker in the autopilot project) for the post to go out.",
      });
    } catch (e) {
      await client.query("rollback");
      return fail(`Could not queue the post: ${e instanceof Error ? e.message : "database error"}`);
    } finally {
      client.release();
    }
  },
);

server.registerTool(
  "get_post_status",
  {
    description: "Check a queued post by its autopilot content id: QUEUED, RUNNING, PUBLISHED or FAILED, attempts, last error and the live URL when known.",
    inputSchema: { contentId: z.string().describe("The contentId returned by publish_post") },
  },
  async ({ contentId }) => {
    const r = await pool.query(
      `select c.platform::text as platform, c.status::text as content_status, j.status::text as job_status, j.attempts, j."lastError" as last_error,
              (j."nextRunAt" at time zone 'utc') as next_run_at,
              (select a."externalId" from "AuditLog" a where a."contentId" = c.id and a.outcome = 'SUCCESS' order by a."createdAt" desc limit 1) as external_id
       from "GeneratedContent" c left join "PublishJob" j on j."contentId" = c.id
       where c.id = $1 order by j."createdAt" desc limit 1`,
      [contentId],
    );
    const row = r.rows[0];
    if (!row) return fail(`No post with content id ${contentId}.`);
    return text({
      platform: row.platform,
      status: row.content_status === "PUBLISHED" ? "PUBLISHED" : row.job_status ?? row.content_status,
      attempts: row.attempts,
      lastError: row.last_error,
      nextRunAt: row.next_run_at,
      url: postUrl(row.platform, row.external_id),
    });
  },
);

server.registerTool(
  "cancel_post",
  {
    description: "Cancel a queued post that has not started publishing yet.",
    inputSchema: { contentId: z.string().describe("The contentId returned by publish_post") },
  },
  async ({ contentId }) => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const j = await client.query(
        `update "PublishJob" set status = 'FAILED'::"JobStatus", "lastError" = 'Cancelled from Socialix', "updatedAt" = ${UTC_NOW}
         where "contentId" = $1 and status = 'QUEUED'::"JobStatus"`,
        [contentId],
      );
      if (j.rowCount === 0) {
        await client.query("rollback");
        return fail("Nothing to cancel: the post is already publishing, published, failed or unknown.");
      }
      await client.query(`update "GeneratedContent" set status = 'REJECTED'::"ContentStatus", "updatedAt" = ${UTC_NOW} where id = $1`, [contentId]);
      await client.query("commit");
      return text({ cancelled: true, contentId });
    } catch (e) {
      await client.query("rollback");
      return fail(`Could not cancel: ${e instanceof Error ? e.message : "database error"}`);
    } finally {
      client.release();
    }
  },
);

server.registerTool(
  "list_recent_posts",
  {
    description: "List the most recent posts queued from Socialix, with their publishing status and live URL when known.",
    inputSchema: { limit: z.number().int().min(1).max(50).default(10) },
  },
  async ({ limit }) => {
    const r = await pool.query(
      `select c.id as content_id, c.platform::text as platform, c.status::text as status, p.title,
              (select j.status::text from "PublishJob" j where j."contentId" = c.id order by j."createdAt" desc limit 1) as job_status,
              (select a."externalId" from "AuditLog" a where a."contentId" = c.id and a.outcome = 'SUCCESS' order by a."createdAt" desc limit 1) as external_id
       from "GeneratedContent" c join "WordPressPost" p on p.id = c."postId"
       where p."wpPostId" like 'socialix-%' order by c."createdAt" desc limit $1`,
      [limit],
    );
    return text(
      r.rows.map((row) => ({
        contentId: row.content_id,
        platform: row.platform,
        title: row.title,
        status: row.status === "PUBLISHED" ? "PUBLISHED" : row.job_status ?? row.status,
        url: postUrl(row.platform, row.external_id),
      })),
    );
  },
);

await server.connect(new StdioServerTransport());
console.error("[social_publisher] MCP server ready on stdio");
