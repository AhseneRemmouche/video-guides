// One small wrapper around an OpenAI-compatible API (Ollama locally, or OpenAI).
//
// Every call returns the text plus what it cost: tokens and seconds. Later labs log these numbers.
import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { z } from "zod";
import * as config from "./config.js";

export const client = new OpenAI({ baseURL: config.BASE_URL, apiKey: config.API_KEY });

export type Message = ChatCompletionMessageParam;
export type Params = Partial<Omit<ChatCompletionCreateParamsNonStreaming, "messages" | "model">>;

export interface Reply {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  seconds: number;
}

/** Send a list of {role, content} messages (or one string) and return a Reply. */
export async function chat(messages: Message[] | string, model?: string, params: Params = {}): Promise<Reply> {
  if (typeof messages === "string") messages = [{ role: "user", content: messages }];
  if (config.REASONING_EFFORT && !("reasoning_effort" in params)) {
    params = { ...params, reasoning_effort: config.REASONING_EFFORT };
  }
  const start = performance.now();
  const response = await client.chat.completions.create({ model: model ?? config.MODEL, messages, ...params });
  return {
    text: response.choices[0]?.message.content ?? "",
    model: response.model,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
    seconds: (performance.now() - start) / 1000,
  };
}

/** Ask for JSON that matches a Zod schema; validate it and retry with the error if it doesn't. */
export async function chatJson<S extends z.ZodType>(
  messages: Message[] | string,
  schema: S,
  name: string,
  model?: string,
  params: Params = {},
  retries = 2,
): Promise<z.infer<S>> {
  messages = typeof messages === "string" ? [{ role: "user", content: messages }] : [...messages];
  const response_format = {
    type: "json_schema" as const,
    json_schema: { name, schema: z.toJSONSchema(schema) as Record<string, unknown> },
  };
  for (let attempt = 0; ; attempt++) {
    const reply = await chat(messages, model, { ...params, response_format });
    let data: unknown;
    try {
      data = JSON.parse(reply.text);
    } catch {
      data = undefined; // not JSON at all: safeParse below reports it
    }
    const result = schema.safeParse(data);
    if (result.success) return result.data;
    if (attempt === retries) throw result.error;
    messages.push(
      { role: "assistant", content: reply.text },
      {
        role: "user",
        content: `That JSON was invalid: ${JSON.stringify(result.error.issues.slice(0, 3))}. Reply with corrected JSON only.`,
      },
    );
  }
}

/** Return one embedding vector (an array of numbers) per input text. */
export async function embed(texts: string[], model?: string): Promise<number[][]> {
  const response = await client.embeddings.create({ model: model ?? config.EMBED_MODEL, input: texts });
  return response.data.map((item) => item.embedding);
}
