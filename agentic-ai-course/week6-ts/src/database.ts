// Port of 6_mcp/database.py — the SQLite file accounts.db with three tables:
// accounts (one JSON document per trader), logs (what the dashboard's log panel shows) and market (cached end-of-day prices).
// Differences: Node's built-in node:sqlite (Node 22.5+) replaces Python's sqlite3, one connection is kept open per process,
// a busy timeout lets several processes (MCP servers, trading floor, API) share the file, and read_log breaks ties by id.
import { DatabaseSync } from "node:sqlite";
import { config } from "dotenv";

config({ override: true, quiet: true });

const DB = "accounts.db";

const db = new DatabaseSync(DB);
db.exec("PRAGMA busy_timeout = 5000");
db.exec("CREATE TABLE IF NOT EXISTS accounts (name TEXT PRIMARY KEY, account TEXT)");
db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    datetime DATETIME,
    type TEXT,
    message TEXT
  )
`);
db.exec("CREATE TABLE IF NOT EXISTS market (date TEXT PRIMARY KEY, data TEXT)");

export function writeAccount(name: string, accountDict: object): void {
  db.prepare(`
    INSERT INTO accounts (name, account)
    VALUES (?, ?)
    ON CONFLICT(name) DO UPDATE SET account=excluded.account
  `).run(name.toLowerCase(), JSON.stringify(accountDict));
}

export function readAccount(name: string): any | null {
  const row = db.prepare("SELECT account FROM accounts WHERE name = ?").get(name.toLowerCase()) as { account: string } | undefined;
  return row ? JSON.parse(row.account) : null;
}

/** Write a log entry to the logs table (the time is SQLite's datetime('now'), which is UTC). */
export function writeLog(name: string, type: string, message: string): void {
  db.prepare("INSERT INTO logs (name, datetime, type, message) VALUES (?, datetime('now'), ?, ?)").run(name.toLowerCase(), type, message);
}

export type LogRow = { datetime: string; type: string; message: string };

/** The most recent log entries for a name, oldest first. */
export function readLog(name: string, lastN = 10): LogRow[] {
  const rows = db.prepare(`
    SELECT datetime, type, message FROM logs
    WHERE name = ?
    ORDER BY datetime DESC, id DESC
    LIMIT ?
  `).all(name.toLowerCase(), lastN) as LogRow[];
  return rows.reverse();
}

export function writeMarket(date: string, data: Record<string, number>): void {
  db.prepare(`
    INSERT INTO market (date, data)
    VALUES (?, ?)
    ON CONFLICT(date) DO UPDATE SET data=excluded.data
  `).run(date, JSON.stringify(data));
}

export function readMarket(date: string): Record<string, number> | null {
  const row = db.prepare("SELECT data FROM market WHERE date = ?").get(date) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : null;
}
