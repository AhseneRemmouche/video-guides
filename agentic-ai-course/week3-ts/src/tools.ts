// The tools the Week 3 crews use, as Agents SDK function tools:
// web search (CrewAI's SerperDevTool), push notification (the course's custom PushNotificationTool),
// and Python code execution in Docker (CrewAI's allow_code_execution with code_execution_mode="safe").
import { execFile } from "node:child_process";
import { tool } from "@openai/agents";
import { z } from "zod";

/** Google search through serper.dev; without SERPER_API_KEY it returns canned text labelled as test data. */
export const searchTool = tool({
  name: "search_the_internet",
  description: "Search the internet with a search query and get the top results.",
  parameters: z.object({ search_query: z.string().describe("Mandatory search query you want to use to search the internet") }),
  execute: async ({ search_query }) => {
    const key = process.env.SERPER_API_KEY;
    console.log(`[search] ${search_query}${key ? "" : " (stand-in: no SERPER_API_KEY)"}`);
    if (!key) {
      return (
        "Search results (canned offline test data, not real news): 1. NovaChip Inc. (ticker NVCP) shares rose after it " +
        "announced a low-power AI accelerator for laptops. 2. Cloudwise Systems (ticker CLWS) reported record cloud revenue " +
        "and a new partnership with a large bank. 3. Quantia Labs (ticker QNTA) published a roadmap for error-corrected " +
        "quantum hardware by 2028."
      );
    }
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q: search_query }),
    });
    const data = (await res.json()) as { organic?: { title: string; link: string; snippet: string }[] };
    return (data.organic ?? []).slice(0, 8).map((r) => `${r.title}\n${r.link}\n${r.snippet}`).join("\n\n");
  },
});

/** Push notification through Pushover (prints only when the keys are missing). */
export const pushTool = tool({
  name: "send_push_notification",
  description: "This tool is used to send a push notification to the user.",
  parameters: z.object({ message: z.string().describe("The message to be sent to the user.") }),
  execute: async ({ message }) => {
    console.log(`Push: ${message}`);
    const user = process.env.PUSHOVER_USER, token = process.env.PUSHOVER_TOKEN;
    if (user && token) {
      await fetch("https://api.pushover.net/1/messages.json", { method: "POST", body: new URLSearchParams({ user, token, message }) });
    }
    return '{"notification": "ok"}';
  },
});

/** Run Python in a throw-away Docker container: no network, limited memory, a time limit. */
export function runPythonInDocker(code: string, timeoutSeconds = 30): Promise<string> {
  return new Promise((resolve) => {
    const child = execFile(
      "docker",
      ["run", "--rm", "-i", "--network", "none", "--memory", "256m", "python:3.12-slim", "python", "-"],
      { timeout: timeoutSeconds * 1000, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => resolve(err && !stdout ? `Error: ${stderr || err.message}` : stdout + (stderr ? `\n[stderr]\n${stderr}` : "")),
    );
    child.stdin?.end(code);
  });
}

export const codeTool = tool({
  name: "run_python",
  description: "Run Python 3 code in a sandboxed Docker container and return what it prints. Print anything you need to see.",
  parameters: z.object({ code: z.string().describe("The complete Python program to run") }),
  execute: async ({ code }) => {
    console.log(`[run_python] ${code.split("\n").length} lines`);
    return runPythonInDocker(code);
  },
});
