// The two tools of Day 3, shared by lab2, lab3 and lab4: an online search (Serper) and a push notification (Pushover).
// Python wraps a plain function with langchain's Tool(name=..., func=..., description=...);
// the JavaScript twin is DynamicTool({ name, func, description }): one string in, one string out.
import { DynamicTool } from "@langchain/core/tools";

/** Google search through serper.dev (Python: GoogleSerperAPIWrapper().run). Without SERPER_API_KEY it returns
 *  canned text that is clearly labelled as a stand-in, so the labs still run end to end. */
export async function serperRun(query: string): Promise<string> {
  const key = process.env.SERPER_API_KEY;
  console.log(`[search] ${query}${key ? "" : " (stand-in: no SERPER_API_KEY)"}`);
  if (!key) {
    return `Search results (canned offline stand-in, not a real search) for "${query}": ` +
      "1. Paris is the capital and largest city of France. 2. The euro (EUR) is the currency of France. " +
      "3. Exchange rates change every day; check a live source such as xe.com.";
  }
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query }),
  });
  const data = (await res.json()) as { answerBox?: { answer?: string; snippet?: string }; organic?: { title: string; snippet: string }[] };
  // like the Python wrapper: the answer box if there is one, otherwise the snippets of the organic results
  if (data.answerBox?.answer || data.answerBox?.snippet) return (data.answerBox.answer ?? data.answerBox.snippet)!;
  return (data.organic ?? []).slice(0, 8).map((r) => `${r.title}: ${r.snippet}`).join(" ");
}

/** Send a push notification to the user (Pushover). Without the keys the message is printed instead. */
export async function push(text: string): Promise<string> {
  const token = process.env.PUSHOVER_TOKEN, user = process.env.PUSHOVER_USER;
  if (!token || !user) {
    console.log(`[push not sent: no PUSHOVER_TOKEN/PUSHOVER_USER] ${text}`);
    return "success (printed, Pushover keys not set)";
  }
  await fetch("https://api.pushover.net/1/messages.json", { method: "POST", body: new URLSearchParams({ token, user, message: text }) });
  return "success"; // Day 5's push returns "success"; the Day 3 version returned None and LangSmith showed null
}

export const toolSearch = new DynamicTool({
  name: "search",
  func: serperRun,
  description: "Useful for when you need more information from an online search",
});

export const toolPush = new DynamicTool({
  name: "send_push_notification",
  func: push,
  description: "useful for when you want to send a push notification",
});
