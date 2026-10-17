import fs from "node:fs";
import path from "node:path";

/**
 * Settings for the whole app. Two sources:
 * 1. this project's .env (non-secret settings + the dashboard login), and
 * 2. the WordPress Social Autopilot's .env (Anthropic key, database URL, site URL), read in place so the
 *    secrets are never copied into this project.
 * Values are never logged.
 */

function parseEnvFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!m) continue;
    let v = m[2]!.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]!] = v;
  }
  return out;
}

const own = { ...parseEnvFile(path.join(process.cwd(), ".env")), ...process.env } as Record<string, string | undefined>;
const autopilotDir = own.AUTOPILOT_DIR ?? "C:/MLSCampus/wordpress-social-autopilot";
const autopilot = parseEnvFile(path.join(autopilotDir, ".env"));

function required(name: string, value: string | undefined, where: string): string {
  if (!value) throw new Error(`Missing ${name} (expected in ${where})`);
  return value;
}

/** The autopilot's database URL, pointed at another database on the same server. */
function withDatabase(url: string, db: string): string {
  const u = new URL(url);
  u.pathname = `/${db}`;
  u.searchParams.delete("schema");
  return u.toString();
}

export const config = {
  autopilotDir,
  get anthropicApiKey() {
    return required("ANTHROPIC_API_KEY", autopilot.ANTHROPIC_API_KEY, `${autopilotDir}/.env`);
  },
  /** The autopilot's own database (connected accounts, publish queue). */
  get autopilotDatabaseUrl() {
    const u = new URL(required("DATABASE_URL", autopilot.DATABASE_URL, `${autopilotDir}/.env`));
    u.searchParams.delete("schema"); // a Prisma-only parameter
    return u.toString();
  },
  /** This app's database: same server and login, its own database name. */
  get appDatabaseUrl() {
    return withDatabase(this.autopilotDatabaseUrl, own.APP_DATABASE_NAME ?? "social_media_ai_agent");
  },
  appDatabaseName: own.APP_DATABASE_NAME ?? "social_media_ai_agent",
  wordpressSiteUrl: autopilot.WORDPRESS_SITE_URL ?? "",
  loginEmail: own.APP_LOGIN_EMAIL ?? "owner@example.com",
  get loginPassword() {
    return required("APP_LOGIN_PASSWORD", own.APP_LOGIN_PASSWORD, ".env (run pnpm db:setup)");
  },
  get sessionSecret() {
    return required("SESSION_SECRET", own.SESSION_SECRET, ".env (run pnpm db:setup)");
  },
  modelSmart: own.MODEL_SMART ?? "claude-sonnet-5-5",
  modelFast: own.MODEL_FAST ?? "claude-haiku-5-5",
};
