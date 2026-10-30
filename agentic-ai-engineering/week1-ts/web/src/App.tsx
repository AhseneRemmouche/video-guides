// Week 1 capstone UI: chat with the "digital twin" career agent.
// Each message is sent to /api/career along with the running history; the
// reply is rendered as markdown with `marked`.
import { useState } from "react";
import { marked } from "marked";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    const history = messages;
    const nextMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/career", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Request failed");
      } else {
        setMessages([...nextMessages, { role: "assistant", content: data.reply ?? "" }]);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") send();
  }

  return (
    <main className="wrap">
      <h1>Career Chat</h1>
      <p className="sub">
        Ask the digital twin about its career, background, skills and experience. Built on plain
        LLM calls + tools - Week 1 of the Agentic AI course, in TypeScript.
      </p>

      <div className="chat">
        {messages.length === 0 && !busy && (
          <div className="empty">Try: "What did you do before Nebula.io?"</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.role === "assistant" ? (
              <div
                className="bubble"
                dangerouslySetInnerHTML={{ __html: marked.parse(m.content) as string }}
              />
            ) : (
              <div className="bubble">{m.content}</div>
            )}
          </div>
        ))}
        {busy && <div className="msg assistant"><div className="bubble muted">Thinking...</div></div>}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask a question..."
          disabled={busy}
        />
        <button onClick={send} disabled={busy || !input.trim()}>
          Send
        </button>
      </div>
    </main>
  );
}
