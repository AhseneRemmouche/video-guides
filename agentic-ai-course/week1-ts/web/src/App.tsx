// A chat page in React, the counterpart of Gradio's ChatInterface: message list, input, send.
import { useEffect, useRef, useState } from "react";
import { marked } from "marked";

type Turn = { role: "user" | "assistant"; content: string };

export function App() {
  const [name, setName] = useState("");
  const [history, setHistory] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((d) => setName(d.name));
  }, []);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [history]);

  async function send() {
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    const before = history; // the history *before* this message, as the API expects
    setHistory([...before, { role: "user", content: message }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: before }),
      });
      const { reply, error } = await res.json();
      setHistory([...before, { role: "user", content: message }, { role: "assistant", content: reply ?? `Error: ${error}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <h1>Chat with {name || "…"}</h1>
      <div className="log">
        {history.map((t, i) => (
          <div key={i} className={`bubble ${t.role}`} dangerouslySetInnerHTML={{ __html: marked.parse(t.content) as string }} />
        ))}
        {busy && <div className="bubble assistant typing">…</div>}
        <div ref={end} />
      </div>
      <form className="row" onSubmit={(e) => (e.preventDefault(), send())}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message…" />
        <button disabled={busy}>Send</button>
      </form>
    </main>
  );
}
