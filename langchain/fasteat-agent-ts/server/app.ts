// The web app's API. Two routes, both answer with a stream of Server-Sent Events:
//   POST /api/photo  { threadId, mimeType, data }  data = the photo as base64 text (5 MB at most)
//   POST /api/chat   { threadId, message }          a follow-up question in the same conversation
// Events: "ingredients" (what the vision model saw), "token" (answer text), "tool_call", "tool_result",
// "done" and "error". A bad photo gets a plain 400 answer with { error } instead.
import { isAIMessage, isToolMessage, type BaseMessage } from "@langchain/core/messages";
import { Hono } from "hono";
import { streamSSE, type SSEStreamingApi } from "hono/streaming";
import { CHEF_PROMPT } from "../chef/prompt.js";
import { log } from "../src/logger.js";
import { chefAgent, decodeIngredients } from "./agent.js";
import { checkUpload, type Upload } from "./upload.js";

type Send = (event: string, data: unknown) => Promise<void>;

/** Run the chef and forward what happens to the browser, step by step. */
async function relayChef(send: Send, text: string, threadId: string) {
  const stream = await chefAgent.stream(
    { messages: [{ role: "user", content: text }] },
    {
      configurable: { thread_id: threadId },
      streamMode: ["messages", "updates"], // tokens as they are written, and each finished step
    },
  );
  for await (const [mode, chunk] of stream) {
    if (mode === "messages") {
      const [token, meta] = chunk;
      // Only text the model writes; tool results also pass through this stream.
      if (meta.langgraph_node === "model_request" && token.text) await send("token", token.text);
      continue;
    }
    for (const update of Object.values(chunk)) {
      const messages = (update as { messages?: BaseMessage[] } | undefined)?.messages ?? [];
      for (const m of messages) {
        if (isAIMessage(m)) {
          for (const call of m.tool_calls ?? []) await send("tool_call", { id: call.id, name: call.name, args: call.args });
        } else if (isToolMessage(m)) {
          await send("tool_result", { id: m.tool_call_id, name: m.name, content: m.text });
        }
      }
    }
  }
}

/** Open the event stream, run the work, and always finish with "done" or "error". */
function events(sse: SSEStreamingApi, work: (send: Send) => Promise<void>) {
  const send: Send = (event, data) => sse.writeSSE({ event, data: JSON.stringify(data) });
  return work(send).then(
    () => send("done", {}),
    (error: Error) => {
      log.warning(error.message);
      return send("error", error.message);
    },
  );
}

export const app = new Hono();

app.post("/api/photo", async (c) => {
  const { threadId, ...upload } = await c.req.json<Upload & { threadId: string }>();
  const checked = checkUpload(upload);
  if ("error" in checked) return c.json({ error: checked.error }, 400);

  return streamSSE(c, (sse) =>
    events(sse, async (send) => {
      log.info("decoding the photo...");
      const ingredients = await decodeIngredients(checked.dataUrl);
      await send("ingredients", ingredients);
      log.info("asking the chef...");
      await relayChef(send, `Ingredients seen in my fridge photo:\n${ingredients}\n\n${CHEF_PROMPT}`, threadId);
    }),
  );
});

app.post("/api/chat", async (c) => {
  const { threadId, message } = await c.req.json<{ threadId: string; message: string }>();
  return streamSSE(c, (sse) => events(sse, (send) => relayChef(send, message, threadId)));
});
