// Week 3 Day 4 — memory, the simple way: save what the crew produced, and put it back into the prompt next time.
// CrewAI's memory=True does this with Chroma (vector search) and SQLite; one JSON file is enough to show the idea.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type MemoryEntry = { date: string; task: string; output: string };

/** Everything remembered so far (an empty list on the first run). */
export async function recall(file: string): Promise<MemoryEntry[]> {
  try {
    return JSON.parse(await readFile(file, "utf-8")) as MemoryEntry[];
  } catch {
    return [];
  }
}

/** Add new entries and keep the last 20. */
export async function remember(file: string, entries: MemoryEntry[]) {
  const all = [...(await recall(file)), ...entries].slice(-20);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(all, null, 2), "utf-8");
}

/** Text added to an agent's backstory. CrewAI's memory also ends up as extra text in the prompt. */
export function memoryPrompt(entries: MemoryEntry[], max = 6) {
  if (!entries.length) return "";
  const lines = entries.slice(-max).map((e) => `- ${e.date.slice(0, 10)} ${e.task}: ${e.output.slice(0, 400)}`);
  return `\n\nWhat you remember from previous runs (use it, and do not pick the same companies again):\n${lines.join("\n")}`;
}
