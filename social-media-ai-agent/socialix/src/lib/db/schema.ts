import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** This app's own tables. The social accounts and the publish queue live in the autopilot's database. */

export const AGENTS = ["master", "research", "creator", "scheduler", "analytics"] as const;
export type AgentRole = (typeof AGENTS)[number];

export const PLATFORMS = ["LINKEDIN", "FACEBOOK", "INSTAGRAM", "X", "TIKTOK", "YOUTUBE"] as const;
export type Platform = (typeof PLATFORMS)[number];

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const campaigns = pgTable("campaigns", {
  id: id(),
  name: text("name").notNull(),
  niche: text("niche").notNull(),
  audience: text("audience").notNull().default(""),
  goal: text("goal").notNull().default(""),
  tone: text("tone").notNull().default("friendly and clear"),
  link: text("link").notNull().default(""), // the URL posts point back to
  platforms: text("platforms").array().notNull().default([]),
  createdAt: createdAt(),
});

/** Chat history, one thread per agent per campaign. */
export const agentMessages = pgTable("agent_messages", {
  id: id(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  agent: text("agent").$type<AgentRole>().notNull(),
  role: text("role").$type<"user" | "assistant">().notNull(),
  content: text("content").notNull(),
  createdAt: createdAt(),
});

export type TaskStatus = "queued" | "running" | "done" | "failed";

/** Work the Master Agent hands to a team member. */
export const agentTasks = pgTable("agent_tasks", {
  id: id(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  agent: text("agent").$type<AgentRole>().notNull(),
  title: text("title").notNull(),
  instructions: text("instructions").notNull().default(""),
  status: text("status").$type<TaskStatus>().notNull().default("queued"),
  result: text("result").notNull().default(""),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Findings saved by the Research Agent. */
export const research = pgTable("research", {
  id: id(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  sources: jsonb("sources").$type<{ title: string; url: string }[]>().notNull().default([]),
  createdAt: createdAt(),
});

export type PostStatus = "draft" | "awaiting_approval" | "queued" | "published" | "failed" | "cancelled";

/** Posts written by the Creator Agent and scheduled by the Scheduler Agent. */
export const posts = pgTable("posts", {
  id: id(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  platform: text("platform").$type<Platform>().notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  hashtags: text("hashtags").array().notNull().default([]),
  link: text("link").notNull().default(""),
  imageUrl: text("image_url"),
  status: text("status").$type<PostStatus>().notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  /** id of the content row in the autopilot's database once handed over for publishing */
  autopilotContentId: text("autopilot_content_id"),
  externalUrl: text("external_url"),
  error: text("error"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

/** Claude usage per agent call, so the dashboard can show what the team costs. */
export const usage = pgTable("usage", {
  id: id(),
  agent: text("agent").$type<AgentRole>().notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  webSearches: integer("web_searches").notNull().default(0),
  createdAt: createdAt(),
});
