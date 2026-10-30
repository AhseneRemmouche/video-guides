// Week 2 chat app: the React replacement for Gradio's ChatInterface (Day 3).
// A message list, an input box and a send button; the assistant reply streams in
// from the Hono /api/chat endpoint and renders as markdown.
import { useRef, useState, useEffect } from "react";
import { marked } from "marked";

type Message = { role: "user" | "assistant"; content: string };

export function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as the reply streams in.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const message = input.trim();
    if (!message || busy) return;
    setBusy(true);
    setError("");
    setInput("");

    const history = messages;
    // Show the user turn immediately, plus an empty assistant turn we stream into.
    setMessages([...history, { role: "user", content: message }, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Request failed");
        // Drop the placeholder assistant turn on failure.
        setMessages([...history, { role: "user", content: message }]);
        return;
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setMessages([
          ...history,
          { role: "user", content: message },
          { role: "assistant", content: text },
        ]);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <main className="wrap">
      <h1>LLM Engineering - Week 2</h1>
      <p className="sub">A streaming chatbot in React - the Day 3 clothes-store assistant, no Gradio.</p>

      <div className="chat" ref={listRef}>
        {messages.length === 0 && (
          <div className="muted empty">Ask about hats, shoes or belts to see the system prompt at work.</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="who">{m.role === "user" ? "You" : "Assistant"}</div>
            {m.role === "assistant" ? (
              <div
                className="bubble"
                dangerouslySetInnerHTML={{ __html: marked.parse(m.content || "...") as string }}
              />
            ) : (
              <div className="bubble">{m.content}</div>
            )}
          </div>
        ))}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="composer">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message, then Enter to send"
          rows={2}
        />
        <button onClick={send} disabled={busy || !input.trim()}>
          {busy ? "..." : "Send"}
        </button>
      </div>
    </main>
  );
}
