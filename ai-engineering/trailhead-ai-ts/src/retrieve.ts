// Three retrievers over the same chunks: BM25 (keywords), embeddings (meaning) and hybrid (both).
import type { Chunk } from "./docs.js";
import { embed } from "./llm.js";

export type Result = [chunk: Chunk, score: number];

export interface Retriever {
  search(query: string, k?: number): Promise<Result[]>;
}

const STOPWORDS = new Set(
  "a an and are as at be can do does for from how i in is it my of on or the to what when where which who with you your".split(" "),
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+(?:\.[0-9]+)?/g) ?? []).filter((w) => !STOPWORDS.has(w));
}

function countWords(words: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  return counts;
}

/** Indexes of the k highest scores, best first. */
function topK(scores: number[], k: number): number[] {
  return scores
    .map((score, i) => [score, i] as const)
    .sort((a, b) => b[0] - a[0])
    .slice(0, k)
    .map(([, i]) => i);
}

/** Okapi BM25: scores a chunk higher when it contains rare query words, often, in a short text. */
export class BM25 implements Retriever {
  private docs: Map<string, number>[];
  private lengths: number[];
  private avgLen: number;
  private idf = new Map<string, number>();

  constructor(private chunks: Chunk[], private k1 = 1.5, private b = 0.75) {
    this.docs = chunks.map((c) => countWords(tokenize(c.text)));
    this.lengths = this.docs.map((d) => [...d.values()].reduce((sum, v) => sum + v, 0));
    this.avgLen = this.lengths.reduce((sum, v) => sum + v, 0) / this.lengths.length;
    const n = chunks.length;
    const df = countWords(this.docs.flatMap((d) => [...d.keys()]));
    for (const [word, f] of df) this.idf.set(word, Math.log(1 + (n - f + 0.5) / (f + 0.5)));
  }

  async search(query: string, k = 3): Promise<Result[]> {
    const words = tokenize(query);
    const scores = this.docs.map((doc, i) => {
      let score = 0;
      for (const word of words) {
        const tf = doc.get(word) ?? 0;
        if (tf) {
          const norm = tf + this.k1 * (1 - this.b + (this.b * this.lengths[i]!) / this.avgLen);
          score += (this.idf.get(word)! * tf * (this.k1 + 1)) / norm;
        }
      }
      return score;
    });
    // A chunk that shares no word with the query (score 0) is not a match, so it is left out. Otherwise the order
    // of all those ties would be arbitrary, and that arbitrary order would leak into hybrid search.
    return topK(scores, k).filter((i) => scores[i]! > 0).map((i) => [this.chunks[i]!, scores[i]!]);
  }
}

export function normalize(v: number[]): number[] {
  const norm = Math.hypot(...v);
  return v.map((x) => x / norm);
}

/** Dot product. For vectors of length 1 it equals the cosine similarity. */
export function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
  return sum;
}

/** Embeds every chunk once; a query is embedded and compared by cosine similarity. */
export class EmbeddingIndex implements Retriever {
  private matrix: Promise<number[][]>;

  constructor(private chunks: Chunk[]) {
    // nomic-embed-text expects these task prefixes; other embedding models simply ignore them.
    // A constructor can't await, so the vectors are a promise that search() waits for.
    this.matrix = embed(chunks.map((c) => `search_document: ${c.text}`)).then((rows) => rows.map(normalize));
  }

  async search(query: string, k = 3): Promise<Result[]> {
    const q = normalize((await embed([`search_query: ${query}`]))[0]!);
    const scores = (await this.matrix).map((row) => dot(row, q));
    return topK(scores, k).map((i) => [this.chunks[i]!, scores[i]!]);
  }
}

/** Merge ranked lists: each chunk gets 1/(c + rank) from every list it appears in. */
export function reciprocalRankFusion(resultLists: Result[][], k = 3, c = 60): Result[] {
  const scores = new Map<string, number>();
  const byId = new Map<string, Chunk>();
  for (const results of resultLists) {
    results.forEach(([chunk], index) => {
      const rank = index + 1;
      scores.set(chunk.id, (scores.get(chunk.id) ?? 0) + 1 / (c + rank));
      byId.set(chunk.id, chunk);
    });
  }
  return [...scores]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([id, score]) => [byId.get(id)!, score]);
}

export class Hybrid implements Retriever {
  private bm25: BM25;
  private dense: EmbeddingIndex;

  constructor(chunks: Chunk[]) {
    this.bm25 = new BM25(chunks);
    this.dense = new EmbeddingIndex(chunks);
  }

  async search(query: string, k = 3, pool = 10): Promise<Result[]> {
    const lists = await Promise.all([this.bm25.search(query, pool), this.dense.search(query, pool)]);
    return reciprocalRankFusion(lists, k);
  }
}
