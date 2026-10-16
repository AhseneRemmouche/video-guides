// Crew runner: pick a crew, edit its inputs, run it and watch each task finish (like CrewAI's verbose output).
import { useEffect, useState } from "react";
import { marked } from "marked";

type Event =
  | { type: "task_start"; task: string; agent: string }
  | { type: "task_end"; task: string; agent: string; output: string }
  | { type: "done" }
  | { type: "error"; message: string };
type Step = { task: string; agent: string; output?: string };

export function App() {
  const [crews, setCrews] = useState<Record<string, Record<string, string>>>({});
  const [crew, setCrew] = useState("debate");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [steps, setSteps] = useState<Step[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/crews").then((r) => r.json()).then((d) => {
      setCrews(d);
      setInputs(d.debate ?? {});
    });
  }, []);

  function choose(name: string) {
    setCrew(name);
    setInputs(crews[name] ?? {});
    setSteps([]);
    setStatus("");
  }

  async function runCrew() {
    setSteps([]);
    setStatus("running");
    const res = await fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ crew, inputs }) });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        const e = JSON.parse(line.slice(6)) as Event;
        if (e.type === "task_start") setSteps((s) => [...s, { task: e.task, agent: e.agent }]);
        else if (e.type === "task_end") setSteps((s) => s.map((x) => (x.task === e.task ? { ...x, output: e.output } : x)));
        else if (e.type === "done") setStatus("done");
        else setStatus(`error: ${e.message}`);
      }
    }
  }

  return (
    <main className="wrap">
      <h1>Crew Runner</h1>
      <div className="row">
        {Object.keys(crews).map((name) => (
          <button key={name} className={name === crew ? "tab on" : "tab"} onClick={() => choose(name)}>
            {name}
          </button>
        ))}
      </div>
      {Object.entries(inputs).map(([k, v]) => (
        <label key={k}>
          {k}
          <input value={v} onChange={(e) => setInputs({ ...inputs, [k]: e.target.value })} />
        </label>
      ))}
      <button className="run" onClick={runCrew} disabled={status === "running"}>
        {status === "running" ? "Running…" : "Kick off"}
      </button>
      {status && status !== "running" && <p className="status">{status}</p>}
      {steps.map((s) => (
        <section key={s.task} className="step">
          <h2>
            {s.output ? "✅" : "⏳"} {s.task} <small>· {s.agent}</small>
          </h2>
          {s.output && <div className="out" dangerouslySetInnerHTML={{ __html: marked.parse(s.output) as string }} />}
        </section>
      ))}
    </main>
  );
}
