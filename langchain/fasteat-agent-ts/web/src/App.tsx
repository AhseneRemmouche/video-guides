import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { postEvents, type AgentEvent } from "./sse";

type Message = { role: "user" | "assistant"; text: string; image?: string; ingredients?: string };
type Step = { id: string; name: string; args: Record<string, unknown>; result?: string };
type Photo = { file: File; preview: string };

// The same rules as the server (server/upload.ts), so mistakes show up before the upload.
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;

/** The file's bytes as base64 text (what the server expects). */
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]); // drop the "data:...;base64," part
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [threadId, setThreadId] = useState(() => crypto.randomUUID()); // one memory per conversation
  const [messages, setMessages] = useState<Message[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [problem, setProblem] = useState("");
  const [dragging, setDragging] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null); // the hidden file input behind "Choose a photo"

  // Change only the last message (the answer being written).
  const updateLast = (change: (m: Message) => Message) =>
    setMessages((all) => [...all.slice(0, -1), change(all[all.length - 1])]);

  function handle(e: AgentEvent) {
    switch (e.event) {
      case "ingredients":
        updateLast((m) => ({ ...m, ingredients: e.data }));
        break;
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
        break;
      }
      case "error":
        updateLast((m) => ({ ...m, text: `${m.text}\n[Error: ${e.data}]` }));
        break;
    }
  }

  async function run(url: string, body: unknown, question: Message) {
    setBusy(true);
    setMessages((all) => [...all, question, { role: "assistant", text: "" }]);
    try {
      await postEvents(url, body, handle);
    } catch (error) {
      handle({ event: "error", data: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function choose(file: File | undefined) {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) return setProblem("Please choose a photo (PNG, JPEG, WebP or GIF).");
    if (file.size > MAX_BYTES) return setProblem(`This photo is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 5 MB.`);
    setProblem("");
    if (photo) URL.revokeObjectURL(photo.preview);
    setPhoto({ file, preview: URL.createObjectURL(file) });
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0]);
  }

  async function sendPhoto() {
    if (!photo || busy) return;
    const data = await readAsBase64(photo.file);
    void run("/api/photo", { threadId, mimeType: photo.file.type, data }, {
      role: "user", text: "What can I cook with this?", image: photo.preview,
    });
    setPhoto(null); // the preview URL stays alive: the message shows it
  }

  function send(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void run("/api/chat", { threadId, message: text }, { role: "user", text });
  }

  function newConversation() {
    setThreadId(crypto.randomUUID());
    setMessages([]);
    setSteps([]);
    setPhoto(null);
    setProblem("");
  }

  // What an answer shows before its first word arrives.
  const placeholder = (m: Message, isLast: boolean) =>
    isLast && busy ? (m.ingredients ? "Looking for a recipe…" : "Looking at your photo…") : "";

  return (
    <div className="page">
      <header>
        <div>
          <p className="eyebrow">FastEat</p>
          <h1>What can I cook from my fridge?</h1>
        </div>
        <button className="ghost" onClick={newConversation} disabled={busy}>New conversation</button>
      </header>

      <main>
        <section className="chat" aria-label="Conversation">
          <div
            className={`drop ${dragging ? "over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={drop}
          >
            {photo ? (
              <img className="preview" src={photo.preview} alt="The fridge photo you chose" />
            ) : (
              <p>Drop a photo of your fridge here, or</p>
            )}
            <div className="row">
              <button type="button" className="ghost" onClick={() => picker.current?.click()} disabled={busy}>
                {photo ? "Choose another" : "Choose a photo"}
              </button>
              <input ref={picker} type="file" accept={IMAGE_TYPES.join(",")} hidden
                onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
              {photo && <button onClick={() => void sendPhoto()} disabled={busy}>Find a recipe</button>}
            </div>
            {problem && <p className="problem" role="alert">{problem}</p>}
          </div>

          {messages.map((m, i) => (
            <article key={i} className={`bubble ${m.role}`}>
              {m.image && <img className="thumb" src={m.image} alt="Your fridge photo" />}
              {m.ingredients && <p className="seen"><strong>Seen in the photo:</strong> {m.ingredients.split("\n").join(", ")}</p>}
              <p>{m.text || placeholder(m, i === messages.length - 1)}</p>
            </article>
          ))}

          <form onSubmit={send}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the chef a follow-up question" disabled={busy} />
            <button disabled={busy || !input.trim()}>Send</button>
          </form>
        </section>

        <aside aria-label="What the chef did">
          <h2>What the chef did</h2>
          {steps.length === 0 && <p className="muted">Web searches appear here as they happen.</p>}
          <ol>
            {steps.map((s) => (
              <li key={s.id}>
                <code>{s.name}({JSON.stringify(s.args)})</code>
                {s.result !== undefined ? <pre>{s.result}</pre> : <span className="muted"> running…</span>}
              </li>
            ))}
          </ol>
        </aside>
      </main>
    </div>
  );
}
