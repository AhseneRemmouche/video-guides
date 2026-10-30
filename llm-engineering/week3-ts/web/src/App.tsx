// Week 3 page: run an open-source HuggingFace model (transformers.js) on your text.
// Pick a task - sentiment or summary - type some text, and the Hono /api/analyze
// endpoint runs the pipeline server-side and returns the result. No Gradio.
import { useState } from "react";

type Task = "sentiment" | "summary";

type SentimentResult = { label: string; score: number };
type AnalyzeResponse = { task: Task; result: SentimentResult | string };

const SAMPLE: Record<Task, string> = {
  sentiment: "I am super excited to be on the way to LLM mastery!",
  summary:
    "The HuggingFace transformers library is an incredibly versatile and powerful tool for " +
    "natural language processing. It lets you perform a wide range of tasks such as text " +
    "classification, named entity recognition, question answering and summarization. It is " +
    "widely used by the open-source data science community and lowers the barrier to entry.",
};

export function App() {
  const [task, setTask] = useState<Task>("sentiment");
  const [input, setInput] = useState(SAMPLE.sentiment);
  const [out, setOut] = useState<AnalyzeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function pickTask(next: Task) {
    setTask(next);
    setInput(SAMPLE[next]);
    setOut(null);
    setError("");
  }

  async function run() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    setOut(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, task }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      setOut(data as AnalyzeResponse);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <h1>LLM Engineering - Week 3</h1>
      <p className="sub">
        Open-source models in the browser stack - HuggingFace pipelines via transformers.js, no Gradio.
      </p>

      <div className="tasks">
        <button className={task === "sentiment" ? "on" : ""} onClick={() => pickTask("sentiment")}>
          Sentiment
        </button>
        <button className={task === "summary" ? "on" : ""} onClick={() => pickTask("summary")}>
          Summary
        </button>
      </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type some text to analyze"
        rows={6}
      />

      <div className="row">
        <button className="run" onClick={run} disabled={busy || !input.trim()}>
          {busy ? "Running..." : "Run pipeline"}
        </button>
        <span className="muted">
          First run downloads the model server-side, so it is slow; later runs are fast.
        </span>
      </div>

      {error && <div className="error">{error}</div>}

      {out && (
        <div className="result">
          <div className="who">Result ({out.task})</div>
          {typeof out.result === "string" ? (
            <p>{out.result}</p>
          ) : (
            <p>
              <strong>{out.result.label}</strong> - {(out.result.score * 100).toFixed(1)}%
            </p>
          )}
        </div>
      )}
    </main>
  );
}
