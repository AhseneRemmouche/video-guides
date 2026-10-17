"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ListChecks, MessageSquare, Send } from "lucide-react";
import type { AgentRole } from "@/lib/db/schema";
import { Markdown } from "@/components/markdown";

type Message = { id: string; role: "user" | "assistant"; content: string; at: string };
type Task = { id: string; agent: AgentRole; title: string; status: string; result: string; at: string };
type State = { status: Record<AgentRole, string>; thinking: boolean; messages: Message[]; tasks: Task[] };
type Member = { role: AgentRole; name: string; short: string; emoji: string; color: string };

const STATUS_DOT: Record<string, string> = { running: "bg-brand-500", done: "bg-emerald-500", failed: "bg-red-500", idle: "bg-gray-300" };
const STATUS_TEXT: Record<string, string> = { running: "Running", done: "Done", failed: "Failed", idle: "Idle" };

const SUGGESTIONS: Record<AgentRole, string[]> = {
  master: ["Research 3 trending topics in my niche and write a LinkedIn and an X post about the best one", "Plan this week's posts and schedule them", "How is the campaign doing?"],
  research: ["What is trending in my niche this week?", "Find 5 popular hashtags for my audience"],
  creator: ["Write an X post from the latest research", "Write a LinkedIn post announcing our new blog article"],
  scheduler: ["Which accounts are connected?", "Schedule all drafts for the best times this week"],
  analytics: ["Give me a status report on the campaign's posts"],
};

export function AgentWorkspace({ campaignId, team, onWorking }: { campaignId: string; team: Member[]; onWorking?: (agents: AgentRole[]) => void }) {
  const [agent, setAgent] = useState<AgentRole>("master");
  const [tab, setTab] = useState<"chat" | "tasks">("chat");
  const [state, setState] = useState<State | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    // A failed poll (server restarting) is skipped; the next one retries.
    const res = await fetch(`/api/agents/state?campaignId=${campaignId}&agent=${agent}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as State;
    setState(data);
    onWorking?.((Object.keys(data.status) as AgentRole[]).filter((a) => data.status[a] === "running"));
  }, [campaignId, agent, onWorking]);

  // Poll faster while something is running, like the live office in the video.
  const busy = Boolean(state && (state.thinking || Object.values(state.status).includes("running")));
  useEffect(() => {
    void load();
    const id = setInterval(load, busy ? 1500 : 5000);
    return () => clearInterval(id);
  }, [load, busy]);

  // Scroll only the chat box, not the page. (Avoid scrollIntoView: newer Chrome returns a Promise from it,
  // which an arrow-bodied effect would hand to React as its cleanup.)
  useEffect(() => {
    const box = bottom.current?.parentElement;
    box?.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [state?.messages.length, state?.thinking]);

  async function send(text: string) {
    if (!text.trim() || sending) return;
    setSending(true);
    setError("");
    const res = await fetch(`/api/agents/${agent}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId, message: text }) });
    if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not send");
    else setInput("");
    setSending(false);
    void load();
  }

  const current = team.find((m) => m.role === agent)!;
  const status = state?.status ?? ({} as Record<AgentRole, string>);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {team.map((m) => {
          const s = status[m.role] ?? "idle";
          return (
            <button key={m.role} onClick={() => setAgent(m.role)} className={`flex items-center gap-3 rounded-2xl border bg-white p-3 text-left transition ${agent === m.role ? "border-brand-500 ring-2 ring-brand-100" : "border-transparent hover:border-gray-200"}`}>
              <span className={`grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br text-lg ${m.color} ${s === "running" ? "working" : ""}`}>{m.emoji}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{m.name}</span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <span className={`size-1.5 rounded-full ${STATUS_DOT[s]}`} /> {STATUS_TEXT[s]}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex min-h-[520px] flex-col rounded-3xl bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-gray-100 p-4">
          <span className={`grid size-11 place-items-center rounded-full bg-gradient-to-br text-xl ${current.color}`}>{current.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{current.name}</p>
            <p className="truncate text-xs text-gray-500">{current.short}</p>
          </div>
          <div className="flex rounded-xl bg-gray-100 p-1 text-sm">
            <button onClick={() => setTab("chat")} className={`flex items-center gap-1 rounded-lg px-3 py-1 ${tab === "chat" ? "bg-white shadow-sm" : "text-gray-500"}`}>
              <MessageSquare size={14} /> Chat
            </button>
            <button onClick={() => setTab("tasks")} className={`flex items-center gap-1 rounded-lg px-3 py-1 ${tab === "tasks" ? "bg-white shadow-sm" : "text-gray-500"}`}>
              <ListChecks size={14} /> Tasks
            </button>
          </div>
        </div>

        {tab === "chat" ? (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: 520 }}>
              {(state?.messages.length ?? 0) === 0 && (
                <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                  Hi! I&apos;m your {current.name}. {current.short}.
                  <div className="mt-3 flex flex-wrap gap-2">
                    {SUGGESTIONS[agent].map((s) => (
                      <button key={s} onClick={() => send(s)} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs hover:border-brand-500">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {state?.messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${m.role === "user" ? "bg-brand-600 text-white" : "bg-gray-50 text-gray-800"}`}>
                    {m.role === "user" ? <p className="whitespace-pre-wrap text-sm">{m.content}</p> : <Markdown text={m.content} />}
                  </div>
                </div>
              ))}
              {state?.thinking && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="flex gap-1 rounded-2xl bg-gray-50 px-4 py-3">
                    <span className="dot size-1.5 rounded-full bg-gray-400" />
                    <span className="dot size-1.5 rounded-full bg-gray-400" />
                    <span className="dot size-1.5 rounded-full bg-gray-400" />
                  </span>
                  {agent === "master" && state.tasks.some((t) => t.status === "running") && <span>Team is working on: {state.tasks.find((t) => t.status === "running")?.title}</span>}
                </div>
              )}
              <div ref={bottom} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="flex items-center gap-2 border-t border-gray-100 p-3"
            >
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Tell the ${current.name} what you need…`} className="flex-1 rounded-xl bg-gray-50 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-100" />
              <button type="submit" aria-label="Send" title="Send" disabled={sending || state?.thinking} className="grid size-10 place-items-center rounded-xl bg-brand-600 text-white disabled:opacity-40">
                <Send size={16} />
              </button>
            </form>
            {error && <p className="px-4 pb-3 text-sm text-red-600">{error}</p>}
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: 580 }}>
            {(state?.tasks.length ?? 0) === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">No tasks yet. Give the Master Agent a request and it will split it into tasks here.</p>
            ) : (
              <ul className="space-y-2">
                {state!.tasks.map((t) => (
                  <li key={t.id} className="rounded-2xl border border-gray-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {team.find((m) => m.role === t.agent)?.emoji} {t.title}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <span className={`size-1.5 rounded-full ${STATUS_DOT[t.status === "queued" ? "idle" : t.status]}`} /> {t.status}
                      </span>
                    </div>
                    {t.result && (
                      <details className="mt-2 text-sm text-gray-600">
                        <summary className="cursor-pointer text-xs text-brand-600">Result</summary>
                        <Markdown text={t.result} />
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
