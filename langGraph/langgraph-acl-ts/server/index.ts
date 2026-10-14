// A small HTTP server for the web app. Run: pnpm api  (then pnpm web in a second terminal)
//   POST /api/chat          { threadId, message } -> a stream of events while the graph runs
//   GET  /api/threads       the thread ids the memory knows
//   GET  /api/threads/:id   the messages saved for one thread (read with graph.getState)
//   GET  /api/graph         the graph as Mermaid text
// Events are Server-Sent Events: "token" (answer text), "step" (one finished node), "done", "error".
import { serve } from "@hono/node-server";
import { AIMessage, HumanMessage, ToolMessage, type BaseMessage } from "langchain";
import { Hono } from "hono";
import { streamSSE, type SSEStreamingApi } from "hono/streaming";
// the agent with math tools and MemorySaver from graph 9
import { graph, memory } from "../module1/9-graph-agent-memory.js";

/** What one message added, in a shape the browser can show. */
function describe(message: BaseMessage) {
  if (AIMessage.isInstance(message) && message.tool_calls?.length) {
    return { kind: "tool_call", text: message.tool_calls.map((c) => `${c.name}(${JSON.stringify(c.args)})`).join(", ") };
  }
  if (ToolMessage.isInstance(message)) return { kind: "tool_result", text: `${message.name ?? "tool"} → ${message.text}` };
  if (AIMessage.isInstance(message)) return { kind: "answer", text: message.text };
  return { kind: "input", text: message.text };
}

/** Run one turn of the graph and forward each step to the browser as it happens. */
async function relay(sse: SSEStreamingApi, threadId: string, message: string) {
  const send = (event: string, data: unknown) => sse.writeSSE({ event, data: JSON.stringify(data) });
  try {
    const stream = await graph.stream(
      { messages: [new HumanMessage(message)] },
      { configurable: { thread_id: threadId }, streamMode: ["updates", "messages"] },
    );
    let step = 0;
    for await (const [mode, chunk] of stream) {
      if (mode === "messages") { // pieces of text while the model writes
        const [token, meta] = chunk;
        if (meta.langgraph_node === "chat_with_tools" && token.text) await send("token", token.text);
        continue;
      }
      // "updates": { nodeName: { messages: [what this node added] } }, once per finished node
      for (const [node, update] of Object.entries(chunk)) {
        const added = (update?.messages ?? []) as BaseMessage[];
        await send("step", { step: ++step, node, added: added.map(describe) });
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
  return streamSSE(c, (sse) => relay(sse, threadId, message));
});

app.get("/api/threads", async (c) => {
  const ids = new Set<string>();
  for await (const saved of memory.list({})) { // every checkpoint of every thread
    ids.add(saved.config.configurable!.thread_id);
  }
  return c.json([...ids]);
});

app.get("/api/threads/:id", async (c) => {
  const state = await graph.getState({ configurable: { thread_id: c.req.param("id") } });
  const messages = (state.values.messages ?? []) as BaseMessage[];
  return c.json(messages.map((m) => ({ type: m.type, ...describe(m) })));
});

app.get("/api/graph", async (c) => c.text((await graph.getGraphAsync()).drawMermaid()));

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.log(`LangGraph agent API on http://localhost:${port}`);
