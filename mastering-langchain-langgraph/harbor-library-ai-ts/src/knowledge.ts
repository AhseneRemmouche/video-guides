// Load, split and index the library's policy documents. Labs 04-07 build this step by step.
import path from "node:path";
import type { Document } from "@langchain/core/documents";
import { DirectoryLoader } from "@langchain/classic/document_loaders/fs/directory";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { DATA, getEmbeddings } from "./config.js";

export async function loadPolicies(): Promise<Document[]> {
  const loader = new DirectoryLoader(path.join(DATA, "policies"), { ".md": (p) => new TextLoader(p) });
  return loader.load();
}

export async function split(docs: Document[], chunkSize = 400, chunkOverlap = 60): Promise<Document[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize, chunkOverlap, separators: ["\n## ", "\n\n", "\n", ". ", " ", ""],
  });
  return splitter.splitDocuments(docs);
}

export async function buildVectorStore(chunks?: Document[]): Promise<MemoryVectorStore> {
  return MemoryVectorStore.fromDocuments(chunks ?? (await split(await loadPolicies())), getEmbeddings());
}

/** Turn retrieved chunks into one context string, each chunk tagged with its source file. */
export function formatDocs(docs: Document[]): string {
  return docs.map((d) => `[${path.basename(d.metadata.source)}]\n${d.pageContent}`).join("\n\n");
}
