// Week 4 Day 5 — the Sidekick's tools (TypeScript version of 4_langgraph/sidekick_tools.py)
// Python takes most tools ready-made from langchain_community / langchain_experimental. LangChain JS has no
// Playwright toolkit, file-management toolkit, Wikipedia tool or Python REPL, so each one is a few lines here.
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { DynamicTool, tool, type StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";
import { playwrightTools } from "../browserTools.js";
import { push, serperRun } from "../tools.js";

/** Python: playwright_tools() → (tools, browser, playwright) */
export const playwright_tools = playwrightTools;

// ---- file tools (Python: FileManagementToolkit(root_dir="sandbox").get_tools()) ----
const ROOT = path.resolve("sandbox"); // relative to where you start the program, like the Python app

/** Resolve a path inside sandbox/ and refuse anything that would escape it (e.g. "../.env"). */
function inSandbox(p: string): string {
  const full = path.resolve(ROOT, p);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) throw new Error(`Access denied: ${p} is outside the sandbox`);
  return full;
}
const pathArg = (description: string) => z.string().describe(description);

/** Wrap a file operation as a tool; errors (missing file, path outside the sandbox) go back to the model as text. */
function fileTool<S extends z.ZodObject>(name: string, description: string, schema: S, run: (args: z.infer<S>) => Promise<string>) {
  const safeRun = async (args: z.infer<S>) => {
    try {
      return await run(args);
    } catch (e) {
      return `Error: ${(e as Error).message}`;
    }
  };
  return tool(safeRun, { name, description, schema });
}

function get_file_tools(): StructuredToolInterface[] {
  const copy_file = fileTool("copy_file", "Create a copy of a file in a specified location",
    z.object({ source_path: pathArg("Path of the file to copy"), destination_path: pathArg("Path to save the copied file") }),
    async ({ source_path, destination_path }) => {
      await fs.copyFile(inSandbox(source_path), inSandbox(destination_path));
      return `File copied successfully from ${source_path} to ${destination_path}.`;
    });

  const file_delete = fileTool("file_delete", "Delete a file", z.object({ file_path: pathArg("Path of the file to delete") }),
    async ({ file_path }) => {
      await fs.unlink(inSandbox(file_path));
      return `File deleted successfully: ${file_path}.`;
    });

  const file_search = fileTool("file_search", "Recursively search for files in a subdirectory that match the regex pattern",
    z.object({ dir_path: pathArg("Subdirectory to search in.").default("."), pattern: z.string().describe("Unix shell regex, where * matches everything.") }),
    async ({ dir_path, pattern }) => {
      const entries = await fs.readdir(inSandbox(dir_path), { recursive: true });
      // turn the shell-style pattern (*.md) into a regular expression (^.*\.md$)
      const re = new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
      const hits = entries.filter((e) => re.test(path.basename(e)));
      return hits.length ? hits.join("\n") : `No files found for pattern ${pattern} in directory ${dir_path}`;
    });

  const move_file = fileTool("move_file", "Move or rename a file from one location to another",
    z.object({ source_path: pathArg("Path of the file to move"), destination_path: pathArg("New path for the moved file") }),
    async ({ source_path, destination_path }) => {
      await fs.rename(inSandbox(source_path), inSandbox(destination_path));
      return `File moved successfully from ${source_path} to ${destination_path}.`;
    });

  const read_file = fileTool("read_file", "Read file from disk", z.object({ file_path: pathArg("name of file") }),
    ({ file_path }) => fs.readFile(inSandbox(file_path), "utf8"));

  const write_file = fileTool("write_file", "Write file to disk",
    z.object({ file_path: pathArg("name of file"), text: z.string().describe("text to write to file"), append: z.boolean().default(false).describe("Whether to append to an existing file.") }),
    async ({ file_path, text, append }) => {
      const full = inSandbox(file_path);
      await fs.mkdir(path.dirname(full), { recursive: true });
      if (append) await fs.appendFile(full, text, "utf8");
      else await fs.writeFile(full, text, "utf8");
      return `File written successfully to ${file_path}.`;
    });

  const list_directory = fileTool("list_directory", "List files and directories in a specified folder",
    z.object({ dir_path: pathArg("Subdirectory to list.").default(".") }),
    async ({ dir_path }) => (await fs.readdir(inSandbox(dir_path))).join("\n") || `No files found in directory ${dir_path}`);

  return [copy_file, file_delete, file_search, move_file, read_file, write_file, list_directory];
}

// ---- Wikipedia (Python: WikipediaQueryRun(api_wrapper=WikipediaAPIWrapper())) via the public REST API ----
async function wikipediaRun(query: string): Promise<string> {
  const headers = { "User-Agent": "agentic-ai-week4-ts/0.1 (course exercise)" }; // Wikipedia asks API clients to identify themselves
  const search = new URL("https://en.wikipedia.org/w/api.php");
  search.search = new URLSearchParams({ action: "query", list: "search", srsearch: query, srlimit: "3", format: "json" }).toString();
  const hits = ((await (await fetch(search, { headers })).json()) as { query?: { search: { title: string }[] } }).query?.search ?? [];
  const pages = await Promise.all(hits.map(async ({ title }) => {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { headers });
    const { extract } = (await res.json()) as { extract?: string };
    return `Page: ${title}\nSummary: ${extract ?? ""}`; // the same "Page: / Summary:" layout as the Python wrapper
  }));
  return pages.length ? pages.join("\n\n").slice(0, 4000) : "No good Wikipedia Search Result was found";
}

// ---- Python (Python: PythonREPLTool(), which runs code on your own machine without any sandbox) ----
/** Run Python in a throw-away Docker container instead: no network, 256 MB of memory, a time limit. */
export function runPythonInDocker(code: string, timeoutSeconds = 30): Promise<string> {
  return new Promise((resolve) => {
    const child = execFile(
      "docker",
      ["run", "--rm", "-i", "--network", "none", "--memory", "256m", "python:3.12-slim", "python", "-"],
      { timeout: timeoutSeconds * 1000, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => resolve(err && !stdout ? `Error: ${stderr || err.message}` : stdout + (stderr ? `\n[stderr]\n${stderr}` : "")),
    );
    child.stdin?.end(code); // the program goes in on standard input ("python -" reads it from there)
  });
}

/** Python: other_tools() — everything except the browser */
export async function other_tools(): Promise<StructuredToolInterface[]> {
  const push_tool = new DynamicTool({ name: "send_push_notification", func: push, description: "Use this tool when you want to send a push notification" });
  const file_tools = get_file_tools();

  const tool_search = new DynamicTool({
    name: "search",
    func: serperRun,
    description: "Use this tool when you want to get the results of an online web search",
  });

  const wiki_tool = new DynamicTool({
    name: "wikipedia",
    func: wikipediaRun,
    description: "A wrapper around Wikipedia. Useful for when you need to answer general questions about people, places, companies, facts, historical events, or other subjects. Input should be a search query.",
  });

  const python_repl = new DynamicTool({
    name: "Python_REPL",
    func: (code) => runPythonInDocker(code),
    description: "A Python shell. Use this to execute python commands. Input should be a valid python command. If you want to see the output of a value, you should print it out with `print(...)`.",
  });

  return [...file_tools, push_tool, tool_search, python_repl, wiki_tool];
}
