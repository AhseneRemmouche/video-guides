// Day 5 - The company brochure (TypeScript port of day5_brochure.py)
// Two LLM calls: first pick the relevant links on a site, then write a brochure
// from those pages. This is a first taste of an "agentic" multi-step workflow.
import "dotenv/config";
import OpenAI from "openai";
import { fetchWebsite, getContents } from "./scrape.js";

const openai = new OpenAI();
const MODEL = "gpt-4o-mini";

interface RelevantLink {
  type: string;
  url: string;
}
interface RelevantLinks {
  links: RelevantLink[];
}

// --- Step 1: ask the model which links matter, answering in strict JSON --------
const linkSystemPrompt = `You are provided with a list of links found on a webpage. \
You are able to decide which of the links would be most relevant to include in a \
brochure about the company, such as links to an About page, or a Company page, or \
Careers/Jobs pages.
You should respond in JSON as in this example:
{
    "links": [
        {"type": "about page", "url": "https://full.url/goes/here/about"},
        {"type": "careers page", "url": "https://another.full.url/careers"}
    ]
}`;

function getLinksUserPrompt(url: string, links: string[]): string {
  let prompt = `Here is the list of links on the website of ${url} - `;
  prompt +=
    "please decide which of these are relevant web links for a brochure about the company, " +
    "respond with the full https URL in JSON format. " +
    "Do not include Terms of Service, Privacy, email links.\n";
  prompt += "Links (some might be relative links):\n";
  prompt += links.join("\n");
  return prompt;
}

async function getLinks(url: string): Promise<RelevantLinks> {
  const site = await fetchWebsite(url);
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: linkSystemPrompt },
      { role: "user", content: getLinksUserPrompt(site.url, site.links) },
    ],
    response_format: { type: "json_object" },
  });
  return JSON.parse(response.choices[0]?.message.content ?? "{}") as RelevantLinks;
}

// --- Step 2: gather those pages and write the brochure -------------------------
async function getAllDetails(url: string): Promise<string> {
  let result = "Landing page:\n";
  result += getContents(await fetchWebsite(url));
  const { links } = await getLinks(url);
  for (const link of links) {
    result += `\n\n${link.type}\n`;
    result += getContents(await fetchWebsite(link.url));
  }
  return result;
}

const brochureSystemPrompt =
  "You are an assistant that analyzes the contents of several relevant pages from a company " +
  "website and creates a short brochure about the company for prospective customers, investors " +
  "and recruits. Respond in markdown. Include details of company culture, customers and " +
  "careers/jobs if you have the information.";

async function getBrochureUserPrompt(companyName: string, url: string): Promise<string> {
  let prompt = `You are looking at a company called: ${companyName}\n`;
  prompt +=
    "Here are the contents of its landing page and other relevant pages; " +
    "use this information to build a short brochure of the company in markdown.\n";
  prompt += await getAllDetails(url);
  return prompt.slice(0, 5_000); // keep within a sensible token budget
}

export async function streamBrochure(companyName: string, url: string): Promise<void> {
  const stream = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: brochureSystemPrompt },
      { role: "user", content: await getBrochureUserPrompt(companyName, url) },
    ],
    stream: true,
  });
  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta.content ?? "");
  }
  process.stdout.write("\n");
}

// Run directly: `npm run day5 -- HuggingFace https://huggingface.co`
const company = process.argv[2] ?? "HuggingFace";
const url = process.argv[3] ?? "https://huggingface.co";
await streamBrochure(company, url);
