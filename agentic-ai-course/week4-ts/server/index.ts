// Week 4 Day 5 — the Sidekick API behind the React app (replaces the Gradio app app.py)
// Gradio keeps one Sidekick per browser tab in gr.State; here the browser sends a threadId and the server keeps
// one Sidekick per threadId in a Map. Each Sidekick has its own Chromium and its own conversation memory.
//   POST /api/run   {message, successCriteria, history, threadId} → {history} (user message, reply, evaluator feedback added)
//   POST /api/reset {threadId}                                     → {threadId} (a fresh Sidekick's id)
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { randomUUID } from "node:crypto";
import { Sidekick, type ChatMessage } from "../src/sidekick/sidekick.js";

type Session = { sidekick: Promise<Sidekick>; lastUsed: number };
const sessions = new Map<string, Session>();

/** Python: async def setup(): sidekick = Sidekick(); await sidekick.setup() — done the first time a thread is seen */
function getSidekick(threadId: string): Promise<Sidekick> {
  let session = sessions.get(threadId);
  if (!session) {
    const sidekick = new Sidekick();
    // store the promise right away, so two quick requests on one thread do not start two browsers
    session = { sidekick: sidekick.setup().then(() => sidekick), lastUsed: Date.now() };
    sessions.set(threadId, session);
  }
  session.lastUsed = Date.now();
  return session.sidekick;
}

/** Python: free_resources(sidekick), which Gradio calls through gr.State(delete_callback=...) */
async function freeResources(threadId: string) {
  const session = sessions.get(threadId);
  if (!session) return;
  sessions.delete(threadId);
  console.log("Cleaning up", threadId);
  try {
    await (await session.sidekick).cleanup();
  } catch (e) {
    console.log(`Exception during cleanup: ${e}`);
  }
}

const app = new Hono();

// Python: process_message(sidekick, message, success_criteria, history)
app.post("/api/run", async (c) => {
  const { message, successCriteria, history, threadId } = await c.req.json<{ message: string; successCriteria: string; history: ChatMessage[]; threadId: string }>();
  if (!message?.trim() || !threadId) return c.json({ error: "message and threadId are required" }, 400);
  try {
    const sidekick = await getSidekick(threadId);
    return c.json({ history: await sidekick.runSuperstep(message, successCriteria, history ?? []) });
  } catch (e) {
    console.error(e);
    return c.json({ error: String(e) }, 500); // e.g. GraphRecursionError when worker and evaluator loop 25 steps
  }
});

// Python: reset() — throw the old Sidekick away and start a new one with empty memory
app.post("/api/reset", async (c) => {
  const { threadId } = await c.req.json<{ threadId?: string }>().catch(() => ({ threadId: undefined }));
  if (threadId) await freeResources(threadId);
  return c.json({ threadId: randomUUID() });
});

app.use("/*", serveStatic({ root: "./web/dist" })); // production build of the React app (pnpm build)

// Close the browsers of tabs that have been idle for 30 minutes (Gradio does the same when a session expires)
setInterval(() => {
  for (const [id, s] of sessions) if (Date.now() - s.lastUsed > 30 * 60_000) void freeResources(id);
}, 60_000).unref();

// Ctrl+C: close every Chromium before exiting
process.on("SIGINT", async () => {
  await Promise.all([...sessions.keys()].map(freeResources));
  process.exit(0);
});

const port = Number(process.env.PORT ?? 8790);
serve({ fetch: app.fetch, port });
console.log(`Sidekick API on http://localhost:${port}`);
