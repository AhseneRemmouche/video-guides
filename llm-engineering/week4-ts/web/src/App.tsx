// Week 4 code optimiser: the React replacement for the Gradio two-box UI (Day 3 / Day 4).
// Python on the left, generated C++ on the right, a model dropdown and an Optimize button.
// The C++ streams in from the Hono /api/optimize endpoint as the model produces it.
import { useState } from "react";

type Model = "gpt-4o" | "claude";

const SAMPLE_PYTHON = `import time

def calculate(iterations, param1, param2):
    result = 1.0
    for i in range(1, iterations+1):
        j = i * param1 - param2
        result -= (1/j)
        j = i * param1 + param2
        result += (1/j)
    return result

start_time = time.time()
result = calculate(100_000_000, 4, 1) * 4
end_time = time.time()

print(f"Result: {result:.12f}")
print(f"Execution Time: {(end_time - start_time):.6f} seconds")
`;

export function App() {
  const [python, setPython] = useState(SAMPLE_PYTHON);
  const [cpp, setCpp] = useState("");
  const [model, setModel] = useState<Model>("gpt-4o");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function optimize() {
    if (!python.trim() || busy) return;
    setBusy(true);
    setError("");
    setCpp("");

    try {
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ python, model }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Request failed");
        return;
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setCpp(text);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <header>
        <h1>LLM Engineering - Week 4</h1>
        <p className="sub">
          Rewrite slow Python as high-performance C++. Paste Python, pick a model, hit Optimize.
        </p>
      </header>

      <div className="toolbar">
        <label>
          Model
          <select value={model} onChange={(e) => setModel(e.target.value as Model)} disabled={busy}>
            <option value="gpt-4o">GPT-4o</option>
            <option value="claude">Claude 3.5 Sonnet</option>
          </select>
        </label>
        <button onClick={optimize} disabled={busy || !python.trim()}>
          {busy ? "Optimizing..." : "Optimize"}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="panes">
        <section className="pane">
          <div className="pane-head">Python</div>
          <textarea
            className="code"
            value={python}
            onChange={(e) => setPython(e.target.value)}
            spellCheck={false}
            placeholder="Paste the Python you want to speed up..."
          />
        </section>
        <section className="pane">
          <div className="pane-head">C++</div>
          <textarea
            className="code"
            value={cpp}
            readOnly
            spellCheck={false}
            placeholder="The generated C++ will stream in here."
          />
        </section>
      </div>
    </main>
  );
}
