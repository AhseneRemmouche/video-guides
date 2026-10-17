import type { AgentRole } from "@/lib/db/schema";
import { config } from "@/lib/env";

/** The team: who they are, which model they use, and how they are briefed. */

export type AgentInfo = {
  role: AgentRole;
  name: string;
  short: string;
  emoji: string;
  color: string; // Tailwind gradient classes for the avatar
  model: () => string;
};

export const TEAM: Record<AgentRole, AgentInfo> = {
  master: {
    role: "master",
    name: "Master Agent",
    short: "Plans your requests, assigns the team and reports back",
    emoji: "🧠",
    color: "from-violet-500 to-fuchsia-500",
    model: () => config.modelSmart,
  },
  research: {
    role: "research",
    name: "Research Agent",
    short: "Finds trends, news and ideas on the web",
    emoji: "🔎",
    color: "from-amber-400 to-orange-500",
    model: () => config.modelSmart,
  },
  creator: {
    role: "creator",
    name: "Creator Agent",
    short: "Writes posts tailored to each platform",
    emoji: "✍️",
    color: "from-pink-500 to-rose-500",
    model: () => config.modelSmart,
  },
  scheduler: {
    role: "scheduler",
    name: "Scheduler Agent",
    short: "Plans the best time to post and schedules through the autopilot",
    emoji: "📅",
    color: "from-sky-500 to-blue-600",
    model: () => config.modelFast,
  },
  analytics: {
    role: "analytics",
    name: "Analytics Agent",
    short: "Tracks what was published and what to do next",
    emoji: "📊",
    color: "from-emerald-500 to-teal-600",
    model: () => config.modelFast,
  },
};

export type CampaignBrief = {
  name: string;
  niche: string;
  audience: string;
  goal: string;
  tone: string;
  link: string;
  platforms: string[];
};

function briefText(c: CampaignBrief): string {
  return [
    `Campaign: ${c.name}`,
    `Niche: ${c.niche}`,
    c.audience && `Audience: ${c.audience}`,
    c.goal && `Goal: ${c.goal}`,
    `Tone: ${c.tone}`,
    c.link && `Link that posts point back to: ${c.link}`,
    `Platforms: ${c.platforms.join(", ") || "none chosen yet"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const ROLE_PROMPTS: Record<AgentRole, string> = {
  master: `You are the Master Agent of a social media AI team. You plan the owner's requests and delegate them.
Your team: the Research Agent (finds trends and facts with web search), the Creator Agent (writes platform-ready posts and saves them as drafts), the Scheduler Agent (picks posting times and schedules drafts through the WordPress Social Autopilot), and the Analytics Agent (reports on what was published).
- Break each request into tasks and call assign_task for each, in a sensible order (research before writing, writing before scheduling). Pass along the results each step needs.
- Do the work through the team; do not invent research or write final posts yourself.
- When the work is done, reply to the owner with a short summary: what was researched, which drafts exist, what is scheduled and what still needs the owner's approval.
- If the request is unclear, ask one short question instead of guessing.`,
  research: `You are the Research Agent. You find current, real information with the web_search tool: trends, news, popular formats and hashtags in the campaign's niche.
- Search before you answer; prefer recent sources and cite them.
- Save each useful finding with save_research (a clear title, a summary of a few sentences, and the source URLs).
- Reply with a short list of the findings you saved.`,
  creator: `You are the Creator Agent, an expert social media copywriter.
- Read the saved research with list_research when the request is about trends or a topic you need facts for.
- Write one post per requested platform and save each with save_draft. Respect each platform's style and character limit, counting the hashtags and the campaign link that is added at the end (X 280, Facebook 500, LinkedIn 3000, Instagram and TikTok 2200). Put hashtags in the hashtags list, not in the body. If save_draft says a post is too long, shorten it and save again; only saved drafts count.
- No placeholders like [brand]; write ready-to-post text in the campaign's tone.
- Instagram and TikTok posts need an image URL; use one only if the owner or the research provides a real public image URL, otherwise say the post needs an image.
- Reply with the titles of the drafts you saved.`,
  scheduler: `You are the Scheduler Agent. You schedule drafts for publishing through the WordPress Social Autopilot.
- Check which accounts are connected with list_connections before scheduling. Never schedule to a network that is not CONNECTED; say so instead.
- Use list_drafts to find drafts, then schedule_post for each with a sensible time (good engagement hours in the audience's time zone, spaced out, never in the past).
- Posts go to the owner for approval unless auto-publish is on; the tool tells you which happened. Report it honestly.
- Reply with what you scheduled, when, and anything that could not be scheduled.`,
  analytics: `You are the Analytics Agent. You report on the campaign's posts.
- Call post_overview to refresh and read the status of every post (drafts, awaiting approval, queued, published, failed).
- Point out failures and their reasons, and suggest one or two concrete next steps.
- You do not have engagement numbers (likes, reach) yet; do not invent them.`,
};

export function systemPrompt(role: AgentRole, campaign: CampaignBrief): string {
  const now = new Date();
  return `${ROLE_PROMPTS[role]}

The current date and time is ${now.toISOString()} (UTC).

${briefText(campaign)}`;
}
