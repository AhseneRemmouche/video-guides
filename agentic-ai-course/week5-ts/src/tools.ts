// Tools for Week 5, as Agents SDK function tools.
// Python wraps LangChain tools with LangChainToolAdapter (GoogleSerperAPIWrapper + FileManagementToolkit).
// There is no adapter in TypeScript, so the same tools are written directly with tool() + a zod schema.
import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tool } from "@openai/agents";
import { z } from "zod";

/** Canned results used when there is no SERPER_API_KEY, so every lab still runs. Clearly labelled as test data. */
function cannedResults(query: string) {
  const q = query.toLowerCase();
  if (q.includes("flight") || q.includes("jfk") || q.includes("lhr")) {
    return (
      "Search results (canned offline test data, not real fares): 1. SampleAir non-stop JFK-LHR one-way from $412, " +
      "departs 19:30, meals included. 2. ExampleJet non-stop JFK-LHR one-way from $389, free WiFi. " +
      "3. DemoWays non-stop JFK-LHR one-way from $455, generous baggage allowance."
    );
  }
  if (q.includes("autogen")) {
    return (
      "Search results (canned offline test data): 1. AutoGen is Microsoft's open-source framework for multi-agent " +
      "applications; version 0.4 was a rewrite with an asynchronous, event-driven core. 2. Users praise its flexible " +
      "agent conversations, teams and the distributed runtime. 3. Users report a learning curve, documentation split " +
      "between 0.2 and 0.4+, and that the distributed runtime is marked experimental."
    );
  }
  return `Search results (canned offline test data): no canned results for "${query}".`;
}

/** Python: Tool(name="internet_search", func=serper.run, description="useful for when you need to search the internet") */
export const searchTool = tool({
  name: "internet_search",
  description: "useful for when you need to search the internet",
  parameters: z.object({ query: z.string().describe("The search query") }),
  execute: async ({ query }) => {
    const key = process.env.SERPER_API_KEY;
    console.log(`[search] ${query}${key ? "" : " (stand-in: no SERPER_API_KEY)"}`);
    if (!key) return cannedResults(query);
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query }),
    });
    const data = (await res.json()) as { organic?: { title: string; link: string; snippet: string }[] };
    return (data.organic ?? []).slice(0, 8).map((r) => `${r.title}\n${r.link}\n${r.snippet}`).join("\n\n");
  },
});

// ---------- File tools confined to one folder (Python: FileManagementToolkit(root_dir="sandbox").get_tools()) ----------
const ROOT = path.resolve("sandbox");

/** Resolve a path inside the sandbox and refuse anything that escapes it (e.g. "../.env"). */
function inSandbox(p: string) {
  const full = path.resolve(ROOT, p);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) throw new Error(`Access denied: ${p} is outside the sandbox`);
  return full;
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(path.relative(ROOT, full));
  }
  return out;
}

const filePath = z.string().describe("Path of the file, relative to the sandbox folder");
const dirPath = z.string().describe("Folder relative to the sandbox; use . for the sandbox itself");

// Same seven names and descriptions as LangChain's toolkit, so the tool list printed in Lab 2 matches the video.
export const fileTools = [
  tool({
    name: "copy_file",
    description: "Create a copy of a file in a specified location",
    parameters: z.object({ source_path: filePath, destination_path: filePath }),
    execute: async ({ source_path, destination_path }) => {
      await copyFile(inSandbox(source_path), inSandbox(destination_path));
      return `File copied successfully from ${source_path} to ${destination_path}.`;
    },
  }),
  tool({
    name: "file_delete",
    description: "Delete a file",
    parameters: z.object({ file_path: filePath }),
    execute: async ({ file_path }) => {
      await rm(inSandbox(file_path));
      return `File deleted successfully: ${file_path}.`;
    },
  }),
  tool({
    name: "file_search",
    description: "Recursively search for files in a subdirectory that match the regex pattern",
    parameters: z.object({ dir_path: dirPath, pattern: z.string() }),
    execute: async ({ dir_path, pattern }) => {
      const files = await walk(inSandbox(dir_path));
      const hits = files.filter((f) => new RegExp(pattern).test(path.basename(f)));
      return hits.length ? hits.join("\n") : `No files found for pattern ${pattern} in directory ${dir_path}`;
    },
  }),
  tool({
    name: "move_file",
    description: "Move or rename a file from one location to another",
    parameters: z.object({ source_path: filePath, destination_path: filePath }),
    execute: async ({ source_path, destination_path }) => {
      await rename(inSandbox(source_path), inSandbox(destination_path));
      return `File moved successfully from ${source_path} to ${destination_path}.`;
    },
  }),
  tool({
    name: "read_file",
    description: "Read file from disk",
    parameters: z.object({ file_path: filePath }),
    execute: async ({ file_path }) => readFile(inSandbox(file_path), "utf-8"),
  }),
  tool({
    name: "write_file",
    description: "Write file to disk",
    parameters: z.object({ file_path: filePath, text: z.string().describe("The text to write") }),
    execute: async ({ file_path, text }) => {
      const full = inSandbox(file_path);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, text, "utf-8");
      return `File written successfully to ${file_path}.`;
    },
  }),
  tool({
    name: "list_directory",
    description: "List files and directories in a specified folder",
    parameters: z.object({ dir_path: dirPath }),
    execute: async ({ dir_path }) => (await readdir(inSandbox(dir_path))).join("\n") || "No files found in directory",
  }),
];
