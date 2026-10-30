// Day 2 - The Chat Completions API, three ways (TypeScript port of day2_chat_api.py)
// 1) the raw HTTPS endpoint, 2) the openai client library, 3) OpenAI-compatible
//    endpoints for other providers (Google Gemini and a local Ollama model).
import "dotenv/config";
import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

// --- 1. Calling the raw HTTP endpoint directly --------------------------------
// This is all the openai library does under the hood: an HTTPS POST with a JSON body.
const payload = {
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Tell me a fun fact" }],
};

const raw = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});
const rawJson = (await raw.json()) as {
  choices: { message: { content: string } }[];
};
console.log(rawJson.choices[0]?.message.content);

// --- 2. The same call with the openai client library --------------------------
// The library is a thin wrapper around the call above - no model code lives in it.
const openai = new OpenAI();
let response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Tell me a fun fact" }],
});
console.log(response.choices[0]?.message.content);

// --- 3. OpenAI-compatible endpoints -------------------------------------------
// Other providers copied OpenAI's endpoint shape, so the same client library works
// if you change baseURL and apiKey.

// Google Gemini (optional - needs GOOGLE_API_KEY in your .env)
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const googleApiKey = process.env.GOOGLE_API_KEY;
if (googleApiKey) {
  const gemini = new OpenAI({ baseURL: GEMINI_BASE_URL, apiKey: googleApiKey });
  response = await gemini.chat.completions.create({
    model: "gemini-2.0-flash",
    messages: [{ role: "user", content: "Tell me a fun fact" }],
  });
  console.log(response.choices[0]?.message.content);
}

// Ollama, running on your own machine (free, no API key - the key is ignored)
// First run `ollama pull llama3.2` in a terminal.
const OLLAMA_BASE_URL = "http://localhost:11434/v1";
const ollama = new OpenAI({ baseURL: OLLAMA_BASE_URL, apiKey: "ollama" });
response = await ollama.chat.completions.create({
  model: "llama3.2",
  messages: [{ role: "user", content: "Tell me a fun fact" }],
});
console.log(response.choices[0]?.message.content);
