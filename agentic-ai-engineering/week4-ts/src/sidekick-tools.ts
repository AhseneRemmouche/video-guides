// Week 4 - the Sidekick's tools module (LangGraph.js port of sidekick_tools.py).
//
// The course wires up external tools that need keys or a browser:
//   * Serper web search          -> needs SERPER_API_KEY, live web calls
//   * Playwright browser toolkit -> needs a real Chromium browser
//   * FileManagementToolkit      -> read/write files in a sandbox folder
//   * Python REPL                -> run Python code
//   * Wikipedia                  -> live API
//   * Pushover push notification -> needs PUSHOVER_TOKEN / PUSHOVER_USER
//
// This port keeps the SAME shapes but uses safe, keyless, browser-free equivalents so
// the app runs anywhere: a local sandbox for files, a JavaScript runner instead of a
// Python REPL, and stubs for web search / Wikipedia / push that explain what the real
// tool would do. Swap any stub for the real API call when you have the keys.
import { tool } from "@langchain/core/tools";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, sep } from "node:path";

// All file tools are confined to this folder, so the model can never touch the rest
// of the disk (the course does the same with FileManagementToolkit(root_dir="sandbox")).
const SANDBOX = resolve(process.cwd(), "sandbox");

/** Resolve a user-supplied path INSIDE the sandbox, or throw if it escapes. */
function safePath(name: string): string {
  const full = resolve(SANDBOX, name);
  if (full !== SANDBOX && !full.startsWith(SANDBOX + sep)) {
    throw new Error("Path escapes the sandbox.");
  }
  return full;
}

const calculator = tool(
  async ({ expression }) => {
    if (!/^[0-9+\-*/(). ]+$/.test(expression)) return "Error: invalid characters.";
    try {
      return String(Function(`"use strict"; return (${expression});`)());
    } catch (err) {
      return `Error: ${String(err)}`;
    }
  },
  {
    name: "calculator",
    description: "Evaluate a basic arithmetic expression, e.g. '2 * (3 + 4)'.",
    schema: z.object({ expression: z.string() }),
  },
);

// Stand-in for Serper web search. Real version: POST to google.serper.dev with
// SERPER_API_KEY and return the organic results. Kept as a stub so there is no key
// and no network call during the guide's build/typecheck.
const webSearch = tool(
  async ({ query }) => {
    const key = process.env.SERPER_API_KEY;
    if (!key) {
      return `[web search stub] No SERPER_API_KEY set, so no live search was run for ${JSON.stringify(
        query,
      )}. With a key this tool would return real web results.`;
    }
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query }),
    });
    const data = (await res.json()) as { organic?: { title: string; link: string; snippet?: string }[] };
    return (data.organic ?? [])
      .slice(0, 5)
      .map((r) => `${r.title}\n${r.link}\n${r.snippet ?? ""}`)
      .join("\n\n");
  },
  {
    name: "web_search",
    description: "Search the web and return the top results. Use for current information.",
    schema: z.object({ query: z.string().describe("the search query") }),
  },
);

const writeFileTool = tool(
  async ({ filename, content }) => {
    await mkdir(SANDBOX, { recursive: true });
    await writeFile(safePath(filename), content, "utf8");
    return `Wrote ${content.length} characters to ${filename}.`;
  },
  {
    name: "write_file",
    description: "Write text to a file in the sandbox folder.",
    schema: z.object({ filename: z.string(), content: z.string() }),
  },
);

const readFileTool = tool(
  async ({ filename }) => {
    try {
      return await readFile(safePath(filename), "utf8");
    } catch {
      return `No such file: ${filename}.`;
    }
  },
  {
    name: "read_file",
    description: "Read a text file from the sandbox folder.",
    schema: z.object({ filename: z.string() }),
  },
);

const listFilesTool = tool(
  async () => {
    try {
      const names = await readdir(SANDBOX);
      return names.length ? names.join("\n") : "(sandbox is empty)";
    } catch {
      return "(sandbox is empty)";
    }
  },
  {
    name: "list_files",
    description: "List the files in the sandbox folder.",
    schema: z.object({}),
  },
);

// Stand-in for the course's Python REPL tool: runs a short JavaScript snippet instead.
// Whatever the snippet returns (or logs) is sent back to the model.
const runJavascript = tool(
  async ({ code }) => {
    const logs: string[] = [];
    const sandboxConsole = { log: (...a: unknown[]) => logs.push(a.map(String).join(" ")) };
    try {
      const fn = new Function("console", `"use strict";\n${code}`);
      const returned = fn(sandboxConsole);
      const out = logs.join("\n");
      return out || (returned !== undefined ? String(returned) : "(no output)");
    } catch (err) {
      return `Error: ${String(err)}`;
    }
  },
  {
    name: "run_javascript",
    description: "Run a short JavaScript snippet and return what it logs or returns.",
    schema: z.object({ code: z.string().describe("JavaScript source to execute") }),
  },
);

// Stand-in for the Pushover push notification. Real version: POST to api.pushover.net
// with PUSHOVER_TOKEN / PUSHOVER_USER. Kept as a stub that just logs.
const pushNotification = tool(
  async ({ message }) => {
    console.log(`[push notification stub] ${message}`);
    return "Notification logged (stub).";
  },
  {
    name: "send_push_notification",
    description: "Send a short push notification to the user.",
    schema: z.object({ message: z.string() }),
  },
);

/** Build the Sidekick's tools. Mirrors other_tools() in the Python course. */
export async function sidekickTools(): Promise<StructuredToolInterface[]> {
  await mkdir(SANDBOX, { recursive: true }).catch(() => {});
  return [
    calculator,
    webSearch,
    writeFileTool,
    readFileTool,
    listFilesTool,
    runJavascript,
    pushNotification,
  ];
}
