// Week 5 "knowledge worker": a RAG chat over the Insurellm knowledge base.
// Ask a question; the Hono /api/ask endpoint retrieves the relevant chunks, calls
// gpt-4o-mini, and returns {answer, sources}. We show the answer plus which docs were used.
import { useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
};

const SUGGESTIONS = [
  "Who won the IIOTY award?",
  "How much does Carllm cost?",
  "What products does Insurellm sell?",
  "Where did Avery Lancaster study?",
];

export function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError("");
    setInput("");

    // History is the plain {role, content} transcript so far (no source metadata).
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages([...messages, { role: "user", content: q }]);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer ?? "", sources: data.sources ?? [] },
      ]);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void ask(input);
    }
  }

  return (
    <main className="wrap">
      <h1>Insurellm Knowledge Worker</h1>
      <p className="sub">
        LLM Engineering - Week 5. Retrieval-augmented generation with LangChain.js: your
        question retrieves the relevant docs, then gpt-4o-mini answers from them.
      </p>

      <div className="chat" ref={listRef}>
        {messages.length === 0 && (
          <div className="muted empty">
            <p>Ask about Insurellm's company, products or employees.</p>
            <div className="suggest">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => void ask(s)} disabled={busy}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="who">{m.role === "user" ? "You" : "Knowledge worker"}</div>
            <div className="bubble">{m.content || "..."}</div>
            {m.role === "assistant" && m.sources && m.sources.length > 0 && (
              <div className="sources">
                <span className="sources-label">Sources:</span>
                {m.sources.map((s) => (
                  <span key={s} className="source-tag">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="muted">Retrieving and answering...</div>}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="composer">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask a question, then Enter to send"
          rows={2}
        />
        <button onClick={() => void ask(input)} disabled={busy || !input.trim()}>
          {busy ? "..." : "Ask"}
        </button>
      </div>
    </main>
  );
}
