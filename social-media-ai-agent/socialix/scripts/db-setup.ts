// Creates this app's database (next to the autopilot's: same server and login), its tables, and the
// dashboard login in .env if missing. Safe to run again. Prints no secrets.
import crypto from "node:crypto";
import fs from "node:fs";
import pg from "pg";
import { config } from "../src/lib/env";

const TABLES = `
create table if not exists campaigns (
  id text primary key, name text not null, niche text not null, audience text not null default '',
  goal text not null default '', tone text not null default 'friendly and clear', link text not null default '',
  platforms text[] not null default '{}', created_at timestamptz not null default now());
create table if not exists agent_messages (
  id text primary key, campaign_id text not null references campaigns(id) on delete cascade,
  agent text not null, role text not null, content text not null, created_at timestamptz not null default now());
create table if not exists agent_tasks (
  id text primary key, campaign_id text not null references campaigns(id) on delete cascade,
  agent text not null, title text not null, instructions text not null default '', status text not null default 'queued',
  result text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists research (
  id text primary key, campaign_id text not null references campaigns(id) on delete cascade,
  title text not null, summary text not null, sources jsonb not null default '[]', created_at timestamptz not null default now());
create table if not exists posts (
  id text primary key, campaign_id text not null references campaigns(id) on delete cascade,
  platform text not null, title text not null, body text not null, hashtags text[] not null default '{}',
  link text not null default '', image_url text, status text not null default 'draft', scheduled_at timestamptz,
  autopilot_content_id text, external_url text, error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists settings (key text primary key, value jsonb not null);
create table if not exists usage (
  id text primary key, agent text not null, model text not null, input_tokens integer not null default 0,
  output_tokens integer not null default 0, web_searches integer not null default 0, created_at timestamptz not null default now());
insert into settings (key, value) values ('autoPublish', 'false') on conflict do nothing;
`;

async function main() {
  // 1. The database itself
  const admin = new pg.Client({ connectionString: config.autopilotDatabaseUrl });
  await admin.connect();
  const exists = await admin.query("select 1 from pg_database where datname = $1", [config.appDatabaseName]);
  if (exists.rowCount === 0) {
    await admin.query(`create database "${config.appDatabaseName.replace(/"/g, "")}"`);
    console.log(`created database ${config.appDatabaseName}`);
  } else console.log(`database ${config.appDatabaseName} already exists`);
  await admin.end();

  // 2. Tables
  const c = new pg.Client({ connectionString: config.appDatabaseUrl });
  await c.connect();
  await c.query(TABLES);
  await c.end();
  console.log("tables ready");

  // 3. Dashboard login, generated once. Read it from .env; it is not printed.
  const envFile = ".env";
  let text = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : fs.readFileSync(".env.example", "utf8");
  const setIfEmpty = (key: string, value: string) => {
    const re = new RegExp(`^${key}=(.*)$`, "m");
    const m = re.exec(text);
    if (m && m[1]!.trim()) return;
    text = m ? text.replace(re, `${key}=${value}`) : `${text.trimEnd()}\n${key}=${value}\n`;
    console.log(`generated ${key} in .env`);
  };
  setIfEmpty("APP_LOGIN_PASSWORD", crypto.randomBytes(12).toString("base64url"));
  setIfEmpty("SESSION_SECRET", crypto.randomBytes(32).toString("base64url"));
  fs.writeFileSync(envFile, text);
}

main().catch((e) => {
  console.error("db setup failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
