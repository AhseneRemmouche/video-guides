// The Deep Research UI in React: a query box, a Run button, a status list and the final markdown report.
// It replaces the Gradio app (deep_research.py). The Hono API runs the whole pipeline and returns JSON,
// so here we POST the query, show the status lines and render the markdown report.
import { useState } from "react";
import { marked } from "marked";

type ResearchResponse = {
  summary: string;
  report: string;
  follow_up_questions: string[];
  status: string[];
};

export function App() {
  const [query, setQuery] = useState("Latest AI Agent frameworks in 2025");
  const [status, setStatus] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const [report, setReport] = useState("");
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  async function runResearch() {
    if (!query.trim() || running) return;
    setRunning(true);
    setStatus([]);
    setSummary("");
    setReport("");
    setFollowUps([]);
    setError("");
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = (await res.json()) as ResearchResponse & { error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      setStatus(data.status ?? []);
      setSummary(data.summary ?? "");
      setReport(data.report ?? "");
      setFollowUps(data.follow_up_questions ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="wrap">
      <header>
        <h1>Deep Research</h1>
        <p className="tagline">
          A multi-agent pipeline built on the OpenAI Agents SDK: a planner proposes searches, search agents run
          them in parallel, a writer synthesizes a report, and an email agent sends it.
        </p>
      </header>

      <label htmlFor="q">What topic would you like to research?</label>
      <div className="row">
        <input
          id="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runResearch()}
          placeholder="e.g. Latest AI Agent frameworks in 2025"
        />
        <button onClick={runResearch} disabled={running}>
          {running ? "Researching..." : "Run"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {status.length > 0 && (
        <ol className="status">
          {status.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}

      {summary && (
        <section className="summary">
          <h2>Summary</h2>
          <p>{summary}</p>
        </section>
      )}

      {report && (
        <article className="report" dangerouslySetInnerHTML={{ __html: marked.parse(report) as string }} />
      )}

      {followUps.length > 0 && (
        <section className="followups">
          <h2>Follow-up questions</h2>
          <ul>
            {followUps.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
