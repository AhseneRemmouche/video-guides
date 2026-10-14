// A small HTTP server for the web app. Run: pnpm api  (then pnpm web in a second terminal)
//   POST /api/chat    { threadId, message }            -> a stream of events
//   POST /api/resume  { threadId, approve, reason? }   -> continues a run that paused for approval
// Events are Server-Sent Events: "token" (answer text), "tool_call", "tool_result", "approval", "done", "error".
import { serve } from "@hono/node-server";
import { isAIMessage, isToolMessage, type BaseMessage } from "@langchain/core/messages";
import { Command, isInterrupted } from "@langchain/langgraph";
import { Hono } from "hono";
import { streamSSE, type SSEStreamingApi } from "hono/streaming";
import type { HITLRequest } from "langchain";
import { agent } from "./agent.js";

type AgentInput = Parameters<typeof agent.stream>[0];

/** Run the agent and forward what happens to the browser, step by step. */
async function relay(sse: SSEStreamingApi, input: AgentInput, threadId: string) {
  const send = (event: string, data: unknown) => sse.writeSSE({ event, data: JSON.stringify(data) });
  try {
    const stream = await agent.stream(input, {
      configurable: { thread_id: threadId },
      streamMode: ["messages", "updates"], // tokens as they are written, and each finished step
    });
    for await (const [mode, chunk] of stream) {
      if (mode === "messages") {
        const [token, meta] = chunk;
        // Only text the model writes; tool results also pass through this stream.
        if (meta.langgraph_node === "model_request" && typeof token.content === "string" && token.content) {
          await send("token", token.content);
        }
        continue;
      }
      if (isInterrupted<HITLRequest>(chunk)) { // the run paused before place_hold: ask the librarian
        const request = chunk.__interrupt__[0].value!;
        await send("approval", request.actionRequests.map((a) => ({ name: a.name, args: a.args })));
        continue;
      }
      for (const update of Object.values(chunk)) {
        const messages = (update as { messages?: BaseMessage[] } | undefined)?.messages ?? [];
        for (const m of messages) {
          if (isAIMessage(m)) {
            for (const call of m.tool_calls ?? []) await send("tool_call", { id: call.id, name: call.name, args: call.args });
          } else if (isToolMessage(m)) {
            await send("tool_result", { id: m.tool_call_id, name: m.name, content: String(m.content) });
          }
        }
      }
    }
    await send("done", {});
  } catch (error) {
    await send("error", (error as Error).message);
  }
}

const app = new Hono();

app.post("/api/chat", async (c) => {
  const { threadId, message } = await c.req.json<{ threadId: string; message: string }>();
  return streamSSE(c, (sse) => relay(sse, { messages: [{ role: "user", content: message }] }, threadId));
});

app.post("/api/resume", async (c) => {
  const { threadId, approve, reason } = await c.req.json<{ threadId: string; approve: boolean; reason?: string }>();
  const decision = approve
    ? { type: "approve" as const }
    : { type: "reject" as const, message: `A librarian rejected this hold: ${reason || "no reason given"}.` };
  return streamSSE(c, (sse) => relay(sse, new Command({ resume: { decisions: [decision] } }) as AgentInput, threadId));
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.log(`Harbor assistant API on http://localhost:${port}`);
