// A small HTTP server for the web app. Run: pnpm api  (then pnpm web in a second terminal)
import { serve } from "@hono/node-server";
import { app } from "./app.js";

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.log(`FastEat chef API on http://localhost:${port}`);
