// Load the knowledge base and split it into chunks.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DATA } from "./config.js";

export interface Chunk {
  id: string; // "returns#0"
  doc: string; // "returns"
  title: string; // "Returns and refunds"
  text: string;
}

/** Return {docId: markdown text} for every file in data/docs. */
export function loadDocs(): Record<string, string> {
  const dir = path.join(DATA, "docs");
  const docs: Record<string, string> = {};
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
    docs[path.basename(file, ".md")] = readFileSync(path.join(dir, file), "utf8").replaceAll("\r\n", "\n");
  }
  return docs;
}

const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

/**
 * Split one document into chunks of whole paragraphs, about maxWords long.
 *
 * Each chunk repeats the last `overlap` paragraphs of the previous one, and every chunk starts
 * with the document title so it still makes sense on its own.
 */
export function chunkDoc(docId: string, text: string, maxWords = 60, overlap = 1): Chunk[] {
  const lines = text.trim().split("\n");
  const title = lines[0]!.replace(/^[#\s]+/, "").trim();
  const paragraphs = lines.slice(1).join("\n").split("\n\n").map((p) => p.trim()).filter(Boolean);
  const chunks: string[][] = [];
  let current: string[] = [];
  for (const para of paragraphs) {
    const size = current.reduce((n, p) => n + countWords(p), 0);
    if (current.length && size + countWords(para) > maxWords) {
      chunks.push(current);
      current = overlap ? current.slice(-overlap) : [];
    }
    current.push(para);
  }
  if (current.length) chunks.push(current);
  return chunks.map((c, i) => ({ id: `${docId}#${i}`, doc: docId, title, text: `${title}\n\n${c.join("\n\n")}` }));
}

export function loadChunks(maxWords = 60, overlap = 1): Chunk[] {
  return Object.entries(loadDocs()).flatMap(([docId, text]) => chunkDoc(docId, text, maxWords, overlap));
}
