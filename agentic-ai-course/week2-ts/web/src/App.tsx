// The Deep Research UI in React: a textbox, a Run button, live status lines and the final markdown report.
// It replaces the Gradio app (deep_research.py): gr.Textbox → <input>, gr.Button → <button>,
// the generator's yields → Server-Sent Events read with fetch + a stream reader.
import { useState } from "react";
import { marked } from "marked";

type Event = { type: "status"; text: string } | { type: "report"; markdown: string } | { type: "error"; message: string };

export function App() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string[]>([]);
  const [report, setReport] = useState("");
  const [running, setRunning] = useState(false);

  async function runResearch() {
    if (!query.trim() || running) return;
    setRunning(true);
    setStatus([]);
    setReport("");
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n"); // SSE events are separated by a blank line
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const event = JSON.parse(line.slice(6)) as Event;
          if (event.type === "status") setStatus((s) => [...s, event.text]);
          else if (event.type === "report") setReport(event.markdown);
          else setStatus((s) => [...s, `Error: ${event.message}`]);
        }
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="wrap">
      <h1>Deep Research</h1>
      <label htmlFor="q">What topic would you like to research?</label>
      <input id="q" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runResearch()} />
      <button onClick={runResearch} disabled={running}>
        {running ? "Running…" : "Run"}
      </button>
      <ul className="status">
        {status.filter((s) => s.length < 300).map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
      {report && <article className="report" dangerouslySetInnerHTML={{ __html: marked.parse(report) as string }} />}
    </main>
  );
}
