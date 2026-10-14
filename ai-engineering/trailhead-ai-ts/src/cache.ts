// Two caches: exact (same text) and semantic (similar meaning).
import { embed } from "./llm.js";
import { dot, normalize } from "./retrieve.js";

export class ExactCache {
  private store = new Map<string, string>();

  static key(text: string): string {
    return text.toLowerCase().split(/\s+/).filter(Boolean).join(" ");
  }

  get(text: string): string | undefined {
    return this.store.get(ExactCache.key(text));
  }

  put(text: string, answer: string): void {
    this.store.set(ExactCache.key(text), answer);
  }
}

/** Returns a stored answer when a new question is close enough to a previous one. */
export class SemanticCache {
  private vectors: number[][] = [];
  private answers: string[] = [];

  constructor(private threshold = 0.9) {}

  private async vector(text: string): Promise<number[]> {
    return normalize((await embed([`search_query: ${text}`]))[0]!);
  }

  /** Returns the cached answer (or undefined) and the best similarity found. */
  async get(text: string): Promise<[answer: string | undefined, similarity: number]> {
    if (!this.vectors.length) return [undefined, 0];
    const v = await this.vector(text);
    const sims = this.vectors.map((row) => dot(row, v));
    const best = sims.indexOf(Math.max(...sims));
    return [sims[best]! >= this.threshold ? this.answers[best] : undefined, sims[best]!];
  }

  async put(text: string, answer: string): Promise<void> {
    this.vectors.push(await this.vector(text));
    this.answers.push(answer);
  }
}
