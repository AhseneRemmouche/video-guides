// The Sidekick UI in React: a request box, a success-criteria box, a Go button, and the
// worker's answer + the evaluator's verdict. It replaces the Gradio app (app.py). The
// Hono API runs the worker/evaluator graph and returns JSON.
import { useState } from "react";

type SidekickResponse = {
  answer: string;
  feedback: string;
  success_criteria_met: boolean;
  user_input_needed: boolean;
  error?: string;
};

export function App() {
  const [message, setMessage] = useState("Work out a 15% tip on a $120 bill and state the amount.");
  const [criteria, setCriteria] = useState("The reply states the tip amount in dollars.");
  const [result, setResult] = useState<SidekickResponse | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  async function run() {
    if (!message.trim() || running) return;
    setRunning(true);
    setResult(null);
    setError("");
    try {
      const res = await fetch("/api/sidekick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, successCriteria: criteria }),
      });
      const data = (await res.json()) as SidekickResponse;
      if (!res.ok || data.error) setError(data.error ?? `Request failed (${res.status})`);
      else setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="wrap">
      <header>
        <h1>Sidekick</h1>
        <p className="tagline">
          A personal co-worker built as a LangGraph.js graph: a <strong>worker</strong> does the task
          (using tools), and an <strong>evaluator</strong> checks the answer against your success
          criteria and sends it back for another try until it is good enough.
        </p>
      </header>

      <label htmlFor="msg">Your request</label>
      <textarea id="msg" value={message} rows={3} onChange={(e) => setMessage(e.target.value)} />

      <label htmlFor="crit">Success criteria</label>
      <input id="crit" value={criteria} onChange={(e) => setCriteria(e.target.value)} />

      <div className="row">
        <button onClick={run} disabled={running}>
          {running ? "Working..." : "Go"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {result && (
        <section className="result">
          <h2>Answer</h2>
          <p className="answer">{result.answer}</p>

          <h3>Evaluator</h3>
          <p className="feedback">{result.feedback}</p>

          <ul className="flags">
            <li className={result.success_criteria_met ? "ok" : "no"}>
              success criteria met: {String(result.success_criteria_met)}
            </li>
            <li className={result.user_input_needed ? "no" : "ok"}>
              more user input needed: {String(result.user_input_needed)}
            </li>
          </ul>
        </section>
      )}

      <p className="hint">
        The API talks to a local Ollama model (llama3.2). Start it with <code>npm run api</code> and
        make sure <code>ollama</code> is running.
      </p>
    </main>
  );
}
