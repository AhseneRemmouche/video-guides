// Shared setup for every lab: environment variables, the model to use, and an optional local-model mode.
//
// Default (like the course): OPENAI_API_KEY in .env, the Responses API and tracing on platform.openai.com.
// Local mode (no OpenAI key): set OPENAI_BASE_URL=http://localhost:11434/v1 OPENAI_API_KEY=ollama MODEL=llama3.2
// The SDK then talks Chat Completions to Ollama's OpenAI-compatible endpoint and tracing is switched off,
// because traces can only be uploaded to OpenAI with a real key.
import "dotenv/config";
import OpenAI from "openai";
import { setDefaultOpenAIClient, setOpenAIAPI, setTracingDisabled } from "@openai/agents";

export const MODEL = process.env.MODEL ?? "gpt-4o-mini";
export const LOCAL = Boolean(process.env.OPENAI_BASE_URL);

if (LOCAL) {
  setDefaultOpenAIClient(new OpenAI({ baseURL: process.env.OPENAI_BASE_URL, apiKey: process.env.OPENAI_API_KEY ?? "ollama" }));
  setOpenAIAPI("chat_completions");
  setTracingDisabled(true);
}

/** Send an email through SendGrid's REST API (the Python labs use the sendgrid package; here plain fetch is enough).
 *  Without SENDGRID_API_KEY the email is printed instead of sent, so every lab still runs end to end. */
export async function sendEmail(subject: string, body: string, type: "text/plain" | "text/html" = "text/plain") {
  const key = process.env.SENDGRID_API_KEY;
  const from = process.env.EMAIL_FROM ?? "you@example.com"; // must be a verified sender in SendGrid
  const to = process.env.EMAIL_TO ?? from;
  if (!key) {
    console.log(`\n[email not sent: no SENDGRID_API_KEY] subject=${JSON.stringify(subject)} type=${type}\n${body.slice(0, 400)}\n`);
    return { status: "printed" };
  }
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content: [{ type, value: body }],
    }),
  });
  console.log("SendGrid status", res.status); // 202 means accepted
  return { status: res.status === 202 ? "success" : `error ${res.status}` };
}
