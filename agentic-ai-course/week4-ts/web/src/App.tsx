// The Sidekick UI in React. It replaces the Gradio app (app.py):
// gr.Chatbot → the message list, two gr.Textbox → two <input>, "Reset" and "Go!" buttons → <button>,
// gr.State(sidekick) → a threadId the server uses to find this tab's Sidekick.
import { useState } from "react";
import { marked } from "marked";

type ChatMessage = { role: "user" | "assistant"; content: string };

const FEEDBACK_PREFIX = "Evaluator Feedback on this answer:"; // the evaluator node starts its message with this

export function App() {
  const [threadId, setThreadId] = useState<string>(() => crypto.randomUUID());
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  // Python: process_message — wired to Go! and to Enter in either textbox, like message.submit / success_criteria.submit
  async function processMessage() {
    if (!message.trim() || running) return;
    setRunning(true);
    setError("");
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, successCriteria, history, threadId }),
      });
      const data = (await res.json()) as { history?: ChatMessage[]; error?: string };
      if (data.history) setHistory(data.history);
      else setError(data.error ?? `HTTP ${res.status}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  // Python: reset — clear both boxes and the chat, and get a brand-new Sidekick
  async function reset() {
    const res = await fetch("/api/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId }) });
    const data = (await res.json()) as { threadId: string };
    setThreadId(data.threadId);
    setMessage("");
    setSuccessCriteria("");
    setHistory([]);
    setError("");
  }

  const onEnter = (e: React.KeyboardEvent) => e.key === "Enter" && processMessage();

  return (
    <main className="wrap">
      <h2>Sidekick Personal Co-Worker</h2>

      <section className="chatbot" aria-label="Sidekick">
        <span className="label">Sidekick</span>
        {history.map((m, i) => {
          const isFeedback = m.role === "assistant" && m.content.startsWith(FEEDBACK_PREFIX);
          return (
            <div key={i} className={`msg ${m.role}${isFeedback ? " feedback" : ""}`}
              dangerouslySetInnerHTML={{ __html: marked.parse(m.content) as string }} />
          );
        })}
        {running && <div className="msg assistant pending">Sidekick is working… (browsing and tool calls can take a few minutes)</div>}
      </section>

      <div className="group">
        <input id="message" value={message} placeholder="Your request to the Sidekick" onChange={(e) => setMessage(e.target.value)} onKeyDown={onEnter} />
        <input id="criteria" value={successCriteria} placeholder="What are your success criteria?" onChange={(e) => setSuccessCriteria(e.target.value)} onKeyDown={onEnter} />
      </div>

      <div className="row">
        <button id="reset" className="stop" onClick={reset} disabled={running}>Reset</button>
        <button id="go" className="primary" onClick={processMessage} disabled={running}>{running ? "Working…" : "Go!"}</button>
      </div>
      {error && <p className="error">Error: {error}</p>}
    </main>
  );
}
