import { useState } from "react";
import { AGENT_NAME, MODEL, conversation, type ChatMessage, type ToolCall } from "./data";

function ToolCallBadge({ call }: { call: ToolCall }) {
  const argStr = Object.entries(call.args)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(", ");
  return (
    <div className="tool-call" role="note" aria-label={`Tool call ${call.name}`}>
      <span className="tool-icon" aria-hidden="true">
        ⚙
      </span>
      <code className="tool-name">{call.name}({argStr})</code>
      <span className="tool-arrow" aria-hidden="true">
        →
      </span>
      <code className="tool-result">{call.result}</code>
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`row ${isUser ? "row-user" : "row-assistant"}`}>
      <div className="avatar" aria-hidden="true">
        {isUser ? "🧑" : "🤖"}
      </div>
      <div className="bubble-wrap">
        <div className="meta">
          <span className="source">{message.source}</span>
          <span className="role-tag">{message.role}</span>
        </div>
        {message.toolCalls?.map((c) => (
          <ToolCallBadge key={c.name + JSON.stringify(c.args)} call={c} />
        ))}
        <div className={`bubble ${isUser ? "bubble-user" : "bubble-assistant"}`}>
          {message.content}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // Local-only draft state: a per-viewer convenience, not wired to any backend.
  const [draft, setDraft] = useState("");

  return (
    <div className="app">
      <div className="demo-banner" role="status">
        Demo UI — representative content only. No AutoGen or model runs behind
        this page.
      </div>

      <header className="header">
        <h1>AutoGen AgentChat</h1>
        <p className="subtitle">
          Week 5 · an <code>AssistantAgent</code> with a Python-function tool
        </p>
        <div className="pills">
          <span className="pill">agent: {AGENT_NAME}</span>
          <span className="pill">model: {MODEL}</span>
          <span className="pill pill-tool">tool: get_city_price</span>
        </div>
      </header>

      <main className="chat">
        {conversation.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}
      </main>

      <footer className="composer">
        <input
          className="composer-input"
          type="text"
          placeholder="Type a message… (demo — not sent anywhere)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Message (demo, disabled)"
        />
        <button className="composer-send" type="button" disabled title="Demo only">
          Send
        </button>
      </footer>
    </div>
  );
}
