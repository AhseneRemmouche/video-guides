// Day 2 / Day 3 - Build the vector store (TypeScript port of the LangChain ingest step)
//
// The Python labs used LangChain's DirectoryLoader + CharacterTextSplitter +
// OpenAIEmbeddings + Chroma. Here we do the LangChain.js equivalent:
//   - read the sample docs under knowledge/  (a hand-rolled DirectoryLoader)
//   - split them with RecursiveCharacterTextSplitter
//   - embed with OpenAIEmbeddings (text-embedding-3-small)
//   - store the vectors in an in-memory MemoryVectorStore (no native deps, no Chroma server)
//
// Everything up to embedding works with no API key; only building the store needs one,
// so rag.ts / the server can import these helpers and stay key-guarded.
import "dotenv/config";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

export const EMBEDDING_MODEL = "text-embedding-3-small";

// knowledge/ sits next to src/ at the project root.
const KNOWLEDGE_DIR = fileURLToPath(new URL("../knowledge", import.meta.url));

export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

// Walk a folder and return every .md / .txt file path (recursively).
function listDocFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listDocFiles(full));
    } else if (/\.(md|txt)$/i.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

// A hand-rolled DirectoryLoader: one Document per file, tagged with its source
// path and a doc_type taken from the top-level folder (company / products / employees).
export function loadDocuments(): Document[] {
  const files = listDocFiles(KNOWLEDGE_DIR);
  return files.map((file) => {
    const rel = relative(KNOWLEDGE_DIR, file).replace(/\\/g, "/");
    const docType = rel.split("/")[0] ?? "general";
    return new Document({
      pageContent: readFileSync(file, "utf-8"),
      metadata: { source: rel, doc_type: docType },
    });
  });
}

// Split the documents into overlapping chunks, mirroring the Python chunk_size/overlap.
export async function splitDocuments(documents: Document[]): Promise<Document[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  return splitter.splitDocuments(documents);
}

// Build the in-memory vector store. Requires OPENAI_API_KEY (embeddings call OpenAI).
export async function buildVectorStore(): Promise<MemoryVectorStore> {
  if (!hasOpenAIKey()) {
    throw new Error("OPENAI_API_KEY is not set - cannot create embeddings. See .env.example.");
  }
  const documents = loadDocuments();
  const chunks = await splitDocuments(documents);
  const embeddings = new OpenAIEmbeddings({ model: EMBEDDING_MODEL });
  return MemoryVectorStore.fromDocuments(chunks, embeddings);
}

async function main(): Promise<void> {
  const documents = loadDocuments();
  console.log(`Loaded ${documents.length} documents from knowledge/`);
  const chunks = await splitDocuments(documents);
  console.log(`Split into ${chunks.length} chunks`);

  if (!hasOpenAIKey()) {
    console.log("OPENAI_API_KEY not set - skipping embedding. Set it in .env to build the store.");
    return;
  }

  const store = await buildVectorStore();
  // MemoryVectorStore keeps vectors on `memoryVectors`; report how many we embedded.
  console.log(`Vector store built with ${store.memoryVectors.length} vectors (model: ${EMBEDDING_MODEL}).`);
}

// Only run when executed directly (npm run ingest), not when imported by rag.ts.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
