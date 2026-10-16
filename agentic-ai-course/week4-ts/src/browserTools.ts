// Browser tools for the agent, written on the `playwright` npm package.
// This file replaces Python's PlayWrightBrowserToolkit (langchain_community), which LangChain JS does not have.
// The seven tools keep the toolkit's names and arguments, so the model sees the same tools as in the course:
// navigate_browser, extract_text, extract_hyperlinks, get_elements, click_element, current_webpage, previous_webpage.
import { chromium, type Browser, type Page } from "playwright";
import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";

/** The page the tools act on: the last open page, or a new one (the toolkit's get_current_page does the same). */
async function currentPage(browser: Browser): Promise<Page> {
  const context = browser.contexts().at(-1) ?? (await browser.newContext());
  return context.pages().at(-1) ?? (await context.newPage());
}

const MAX_TEXT = 8000; // keep tool results small enough for a small local model's context window

/** Python: PlayWrightBrowserToolkit.from_browser(async_browser=browser).get_tools() */
export function browserTools(browser: Browser): StructuredToolInterface[] {
  const navigate_browser = tool(
    async ({ url }) => {
      const page = await currentPage(browser);
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      return `Navigating to ${url} returned status code ${response?.status() ?? "unknown"}`;
    },
    { name: "navigate_browser", description: "Navigate a browser to the specified URL", schema: z.object({ url: z.string().describe("url to navigate to") }) },
  );

  const extract_text = tool(
    async () => {
      const page = await currentPage(browser);
      const text = (await page.innerText("body")).replace(/\s+/g, " ").trim(); // the Python tool uses BeautifulSoup's get_text
      return text.slice(0, MAX_TEXT);
    },
    { name: "extract_text", description: "Extract all the text on the current webpage", schema: z.object({}) },
  );

  const extract_hyperlinks = tool(
    async ({ absolute_urls }) => {
      const page = await currentPage(browser);
      const links = await page.$$eval("a[href]", (as, abs) => as.map((a) => (abs ? (a as HTMLAnchorElement).href : a.getAttribute("href") ?? "")), absolute_urls);
      return JSON.stringify([...new Set(links)].slice(0, 200));
    },
    {
      name: "extract_hyperlinks",
      description: "Extract all hyperlinks on the current webpage",
      schema: z.object({ absolute_urls: z.boolean().default(false).describe("Return absolute URLs instead of relative URLs") }),
    },
  );

  const get_elements = tool(
    async ({ selector, attributes }) => {
      const page = await currentPage(browser);
      const elements = await page.$$eval(selector, (els, attrs) =>
        els.slice(0, 50).map((el) => Object.fromEntries(attrs.map((a) => [a, a === "innerText" ? (el as HTMLElement).innerText : el.getAttribute(a)]))),
        attributes,
      );
      return JSON.stringify(elements);
    },
    {
      name: "get_elements",
      description: "Retrieve elements in the current web page matching the given CSS selector",
      schema: z.object({
        selector: z.string().describe("CSS selector, such as '*', 'div', 'p', 'a', #id, .classname"),
        attributes: z.array(z.string()).default(["innerText"]).describe("Set of attributes to retrieve for each element"),
      }),
    },
  );

  const click_element = tool(
    async ({ selector }) => {
      const page = await currentPage(browser);
      try {
        await page.click(selector, { timeout: 5_000 }); // only visible elements, like the toolkit's default
      } catch {
        return `Unable to click on element '${selector}'`;
      }
      return `Clicked element '${selector}'`;
    },
    { name: "click_element", description: "Click on an element with the given CSS selector", schema: z.object({ selector: z.string().describe("CSS selector for the element to click") }) },
  );

  const current_webpage = tool(async () => (await currentPage(browser)).url(), {
    name: "current_webpage",
    description: "Returns the URL of the current page",
    schema: z.object({}),
  });

  const previous_webpage = tool(
    async () => {
      const response = await (await currentPage(browser)).goBack();
      return response ? `Navigated back to the previous page with URL '${response.url()}'. Status code ${response.status()}` : "Unable to navigate back; no previous page in the history";
    },
    { name: "previous_webpage", description: "Navigate back to the previous page in the browser history", schema: z.object({}) },
  );

  return [click_element, navigate_browser, previous_webpage, extract_text, extract_hyperlinks, get_elements, current_webpage];
}

/** Python (sidekick_tools.py): playwright_tools() → (tools, browser, playwright). Here the browser object also stops Playwright.
 *  The course runs headful (headless=False) so you can watch the agent; set HEADLESS=true to hide the window. */
export async function playwrightTools() {
  const browser = await chromium.launch({ headless: process.env.HEADLESS === "true" });
  return { tools: browserTools(browser), browser };
}
