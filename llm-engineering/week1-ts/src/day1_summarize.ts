// Day 1 - Website Summarizer (TypeScript port of day1_summarize.py)
// A tiny "Reader's Digest of the internet": give it a URL, get back a short summary.
import "dotenv/config";
import OpenAI from "openai";
import { fetchWebsite, type Website } from "./scrape.js";

// Check the key the same way the notebook does
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.log("No API key was found - check your .env file");
} else if (!apiKey.startsWith("sk-proj-")) {
  console.log("An API key was found, but it doesn't start sk-proj- - please check it");
} else {
  console.log("API key found and looks good so far!");
}

const MODEL = "gpt-4o-mini";

// A system prompt tells the model what role to play and how to behave
const systemPrompt =
  "You are an assistant that analyzes the contents of a website and provides a short " +
  "summary, ignoring text that might be navigation related. Respond in markdown.";

// A user prompt is the actual request. We build it from the scraped page.
function userPromptFor(site: Website): string {
  let prompt = `You are looking at a website titled ${site.title}\n`;
  prompt +=
    "The contents of this website is as follows; please provide a short summary of this " +
    "website in markdown. If it includes news or announcements, then summarize these too.\n\n";
  prompt += site.text;
  return prompt;
}

// The OpenAI API expects a list of messages, each with a role and content
function messagesFor(site: Website): OpenAI.ChatCompletionMessageParam[] {
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPromptFor(site) },
  ];
}

export async function summarize(url: string): Promise<string> {
  const openai = new OpenAI(); // reads OPENAI_API_KEY from the environment
  const site = await fetchWebsite(url);
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: messagesFor(site),
  });
  return response.choices[0]?.message.content ?? "";
}

// Run directly: `npm run day1 -- https://example.com` (defaults to edwarddonner.com)
const target = process.argv[2] ?? "https://edwarddonner.com";
console.log(await summarize(target));
