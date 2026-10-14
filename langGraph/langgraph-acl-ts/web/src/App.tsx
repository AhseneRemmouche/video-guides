import { useEffect, useState, type FormEvent } from "react";
import { postEvents, type Added, type GraphEvent, type Step } from "./sse";

type Message = { role: "user" | "assistant"; text: string };

const EXAMPLES = ["Add 3 and 4.", "Now multiply that by 10.", "What is 12 multiplied by 7?"];

const newThreadId = () => `thread-${crypto.randomUUID().slice(0, 6)}`;

export default function App() {
  const [threads, setThreads] = useState<string[]>([]);
  const [threadId, setThreadId] = useState(newThreadId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [saved, setSaved] = useState<number | null>(null); // messages the memory had when the thread was opened
  const [mermaid, setMermaid] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  // On start: the threads the server's memory already knows, and the drawing of the graph.
  useEffect(() => {
    fetch("/api/threads").then((r) => r.json()).then((ids: string[]) => setThreads(ids)).catch(() => {});
    fetch("/api/graph").then((r) => r.text()).then(setMermaid).catch(() => setMermaid("(server not running)"));
  }, []);

  // Change only the last message (the answer being written).
  const updateLast = (change: (m: Message) => Message) =>
    setMessages((all) => [...all.slice(0, -1), change(all[all.length - 1])]);

  function handle(e: GraphEvent) {
    switch (e.event) {
      case "token":
        updateLast((m) => ({ ...m, text: m.text + e.data }));
        break;
      case "step": {
        setSteps((all) => [...all, e.data]);
        const answer = e.data.added.find((a) => a.kind === "answer");
        if (answer) updateLast((m) => ({ ...m, text: answer.text })); // the finished answer replaces the pieces
        break;
      }
      case "error":
        updateLast((m) => ({ ...m, text: `${m.text}\n[Error: ${e.data}]` }));
        break;
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setSteps([]);
    setThreads((all) => (all.includes(threadId) ? all : [...all, threadId]));
    setMessages((all) => [...all, { role: "user", text }, { role: "assistant", text: "" }]);
    try {
      await postEvents("/api/chat", { threadId, message: text }, handle);
    } catch (error) {
      handle({ event: "error", data: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  // Open an older thread: the server reads what its memory saved for it (graph.getState).
  async function openThread(id: string) {
    setThreadId(id);
    setSteps([]);
    const history: (Added & { type: string })[] = await (await fetch(`/api/threads/${encodeURIComponent(id)}`)).json();
    setSaved(history.length);
    setMessages(history
      .filter((m) => m.type === "human" || m.kind === "answer")
      .map((m) => ({ role: m.type === "human" ? "user" : "assistant", text: m.text })));
  }

  function newThread() {
    setThreadId(newThreadId());
    setMessages([]);
    setSteps([]);
    setSaved(null);
  }

  return (
    <div className="page">
      <header>
        <div>
          <p className="eyebrow">LangGraph.js · graph 9</p>
          <h1>Math teacher with memory</h1>
        </div>
        <button onClick={newThread} disabled={busy}>New thread</button>
      </header>

      <nav aria-label="Threads">
        <span className="muted">Threads:</span>
        {[...new Set([...threads, threadId])].map((id) => (
          <button key={id} className={`chip ${id === threadId ? "current" : ""}`} onClick={() => openThread(id)}
            disabled={busy} aria-current={id === threadId}>{id}</button>
        ))}
      </nav>

      <main>
        <section className="chat" aria-label="Conversation">
          {saved !== null && <p className="muted">Loaded {saved} saved messages for {threadId}.</p>}
          {messages.length === 0 && (
            <div className="empty">
              <p>Ask a math question. Try, one after the other:</p>
              {EXAMPLES.map((q) => (
                <button key={q} className="example" onClick={() => setInput(q)}>{q}</button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <article key={i} className={`bubble ${m.role}`}>
              <p>{m.text || (i === messages.length - 1 && busy ? "…" : "")}</p>
            </article>
          ))}
          <form onSubmit={send}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a question" disabled={busy} />
            <button disabled={busy || !input.trim()}>Send</button>
          </form>
        </section>

        <aside aria-label="Graph steps">
          <h2>Graph steps</h2>
          {steps.length === 0 && <p className="muted">Each node appears here as it finishes.</p>}
          <ol>
            {steps.map((s) => (
              <li key={s.step}>
                <code className="node">{s.node}</code>
                {s.added.map((a, i) => (
                  <div key={i} className={`added ${a.kind}`}><span>{LABELS[a.kind]}</span> {a.text}</div>
                ))}
              </li>
            ))}
          </ol>
          <details>
            <summary>The graph (Mermaid text)</summary>
            <pre>{mermaid}</pre>
          </details>
        </aside>
      </main>
    </div>
  );
}

const LABELS: Record<Added["kind"], string> = {
  input: "input",
  tool_call: "asks for a tool:",
  tool_result: "tool result:",
  answer: "final answer:",
};
