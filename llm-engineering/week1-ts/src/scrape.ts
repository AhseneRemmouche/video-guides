// Shared website scraping, the TypeScript counterpart of the Python `Website` class.
// `parseWebsite` works on an HTML string (offline, testable); `fetchWebsite` adds the network fetch.
import { parse } from "node-html-parser";

// Some websites refuse a request that has no User-Agent header, so we send a normal browser one
export const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
};

/** A scraped website: its title, its visible text, and the links it contains. */
export interface Website {
  url: string;
  title: string;
  text: string;
  links: string[];
}

// The tags whose content is noise for a summary (scripts, styles, images, form inputs).
const IRRELEVANT = ["script", "style", "img", "input"];

/** Parse an HTML string into a Website. Mirrors BeautifulSoup: strip noise tags, keep body text + links. */
export function parseWebsite(html: string, url: string): Website {
  const root = parse(html);

  const titleEl = root.querySelector("title");
  const title = titleEl ? titleEl.text.trim() : "No title found";

  const body = root.querySelector("body") ?? root;
  for (const tag of IRRELEVANT) {
    for (const el of body.querySelectorAll(tag)) el.remove();
  }
  const text = body.structuredText.trim();

  const links = root
    .querySelectorAll("a")
    .map((a) => a.getAttribute("href"))
    .filter((href): href is string => Boolean(href));

  return { url, title, text, links };
}

/** Fetch a URL and parse it. Uses the global fetch (Node 18+). */
export async function fetchWebsite(url: string): Promise<Website> {
  const response = await fetch(url, { headers });
  const html = await response.text();
  return parseWebsite(html, url);
}

/** Webpage Title + Contents, the string fed to the brochure model (Website.get_contents in Python). */
export function getContents(site: Website): string {
  return `Webpage Title:\n${site.title}\nWebpage Contents:\n${site.text}\n\n`;
}
