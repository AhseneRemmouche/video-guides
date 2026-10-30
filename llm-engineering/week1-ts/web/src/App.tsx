// Week 1 demo page: summarize any website (Day 1) or write a company brochure (Day 5).
// Both call the Hono API and render the returned markdown with `marked`.
import { useState } from "react";
import { marked } from "marked";

export function App() {
  const [url, setUrl] = useState("https://edwarddonner.com");
  const [company, setCompany] = useState("Edward Donner");
  const [markdown, setMarkdown] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function summarize() {
    if (busy) return;
    setBusy(true);
    setError("");
    setMarkdown("");
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Request failed");
      else setMarkdown(data.summary ?? "");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function makeBrochure() {
    if (busy) return;
    setBusy(true);
    setError("");
    setMarkdown("");
    try {
      const res = await fetch("/api/brochure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, url }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Request failed");
        return;
      }
      // The brochure endpoint streams markdown; append chunks as they arrive.
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setMarkdown(text);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <h1>LLM Engineering - Week 1</h1>
      <p className="sub">Day 1 website summarizer and Day 5 company brochure, in TypeScript.</p>

      <label>
        Website URL
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
      </label>
      <label>
        Company name
        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Example Inc." />
      </label>

      <div className="row">
        <button onClick={summarize} disabled={busy}>Summarize</button>
        <button onClick={makeBrochure} disabled={busy} className="secondary">Make brochure</button>
      </div>

      {error && <div className="error">{error}</div>}
      {busy && !markdown && <div className="muted">Working...</div>}
      {markdown && (
        <article className="result" dangerouslySetInnerHTML={{ __html: marked.parse(markdown) as string }} />
      )}
    </main>
  );
}
