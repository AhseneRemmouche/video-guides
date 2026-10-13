import { useState, type FormEvent } from "react";
import { postEvents, type AgentEvent } from "./sse";

type Message = { role: "user" | "assistant"; text: string; sources: string[] };
type Step = { id: string; name: string; args: Record<string, unknown>; result?: string };
type Approval = { name: string; args: Record<string, unknown> }[];

const EXAMPLES = [
  "How much is the late fee for a book?",
  "Do you have books by Mara Quint? Is one on the shelf?",
  "I'm member M-1001. Please place a hold on B007.",
];

export default function App() {
  const [threadId, setThreadId] = useState(() => crypto.randomUUID()); // one memory per conversation
  const [messages, setMessages] = useState<Message[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [reason, setReason] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  // Change only the last message (the answer being written).
  const updateLast = (change: (m: Message) => Message) =>
    setMessages((all) => [...all.slice(0, -1), change(all[all.length - 1])]);

  function handle(e: AgentEvent) {
    switch (e.event) {
      case "token":
        updateLast((m) => ({ ...m, text: m.text + e.data }));
        break;
      case "tool_call": {
        const call = e.data;
        setSteps((all) => (all.some((s) => s.id === call.id) ? all : [...all, call]));
        break;
      }
      case "tool_result": {
        const result = e.data;
        setSteps((all) => all.map((s) => (s.id === result.id ? { ...s, result: result.content } : s)));
        if (result.name === "search_policies") {
          const files = [...result.content.matchAll(/\[([\w-]+\.md)\]/g)].map((match) => match[1]);
          updateLast((m) => ({ ...m, sources: [...new Set([...m.sources, ...files])] }));
        }
        break;
      }
      case "approval":
        setApproval(e.data);
        updateLast((m) => (m.text ? m : { ...m, text: "Paused: a librarian must approve this first." }));
        break;
      case "error":
        updateLast((m) => ({ ...m, text: `${m.text}\n[Error: ${e.data}]` }));
        break;
    }
  }

  async function run(url: string, body: unknown, userText?: string) {
    setBusy(true);
    setMessages((all) => [
      ...all,
      ...(userText ? [{ role: "user" as const, text: userText, sources: [] }] : []),
      { role: "assistant", text: "", sources: [] },
    ]);
    try {
      await postEvents(url, body, handle);
    } catch (error) {
      handle({ event: "error", data: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function send(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void run("/api/chat", { threadId, message: text }, text);
  }

  function decide(approve: boolean) {
    setApproval(null);
    void run("/api/resume", { threadId, approve, reason });
    setReason("");
  }

  function newConversation() {
    setThreadId(crypto.randomUUID());
    setMessages([]);
    setSteps([]);
    setApproval(null);
  }

  // What an answer shows before its first word arrives.
  const placeholder = (isLast: boolean) => (isLast && busy ? "…" : "");

  return (
    <div className="page">
      <header>
        <div>
          <p className="eyebrow">Harbor City Library</p>
          <h1>Ask the library assistant</h1>
        </div>
        <button className="ghost" onClick={newConversation} disabled={busy}>New conversation</button>
      </header>

      <main>
        <section className="chat" aria-label="Conversation">
          {messages.length === 0 && (
            <div className="empty">
              <p>Ask about opening hours, fees, rooms or the catalog. Try:</p>
              {EXAMPLES.map((q) => (
                <button key={q} className="example" onClick={() => setInput(q)}>{q}</button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <article key={i} className={`bubble ${m.role}`}>
              <p>{m.text || placeholder(i === messages.length - 1)}</p>
              {m.sources.length > 0 && <p className="sources">Looked up in: {m.sources.join(", ")}</p>}
            </article>
          ))}

          {approval && (
            <div className="approval" role="alert">
              <strong>A librarian must approve this action</strong>
              {approval.map((a, i) => (
                <code key={i}>{a.name}({JSON.stringify(a.args)})</code>
              ))}
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason if you reject (optional)" />
              <div className="row">
                <button onClick={() => decide(true)}>Approve</button>
                <button className="ghost" onClick={() => decide(false)}>Reject</button>
              </div>
            </div>
          )}

          <form onSubmit={send}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a question" disabled={busy || !!approval} />
            <button disabled={busy || !!approval || !input.trim()}>Send</button>
          </form>
        </section>

        <aside aria-label="What the agent did">
          <h2>What the agent did</h2>
          {steps.length === 0 && <p className="muted">Tool calls appear here as they happen.</p>}
          <ol>
            {steps.map((s) => (
              <li key={s.id}>
                <code>{s.name}({JSON.stringify(s.args)})</code>
                {s.result !== undefined ? <pre>{s.result}</pre>
                  : <span className="muted"> {approval ? "waiting for approval" : "running…"}</span>}
              </li>
            ))}
          </ol>
        </aside>
      </main>
    </div>
  );
}
