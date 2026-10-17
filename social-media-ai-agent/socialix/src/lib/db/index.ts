import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "@/lib/env";
import * as schema from "./schema";

// One pool per process, reused across hot reloads in development.
const g = globalThis as unknown as { __appPool?: pg.Pool };
const pool = g.__appPool ?? new pg.Pool({ connectionString: config.appDatabaseUrl, max: 5 });
if (process.env.NODE_ENV !== "production") g.__appPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
