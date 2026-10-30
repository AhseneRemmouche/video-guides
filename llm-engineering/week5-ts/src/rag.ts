// Day 4 / Day 5 - The RAG pipeline (TypeScript port of the knowledge-worker project)
//
// The Python course wired a retriever + an LLM + conversation history into a
// ConversationalRetrievalChain and served it with Gradio. Here we build the same
// pieces with LangChain.js and expose a single `answer(question, history)` function
// that the Hono server and the `npm run ask` CLI both reuse.
//
//   retriever (MemoryVectorStore.asRetriever) -> context -> ChatOpenAI (gpt-4o-mini) -> answer
//
// Key-guarded: it imports cleanly with no API key; answer() only needs one at call time.
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage, AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { Document } from "@langchain/core/documents";
import type { MemoryVectorStore } from "langchain/vectorstores/memory";
import { buildVectorStore, hasOpenAIKey } from "./ingest.js";

export const MODEL = "gpt-4o-mini";
export const RETRIEVAL_K = 4;

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type RagAnswer = { answer: string; sources: string[] };

const SYSTEM_PROMPT = `You are a knowledgeable, friendly assistant representing the company Insurellm.
You are chatting with a user about Insurellm, its employees and its products.
Answer only from the context extracts provided below. Be accurate, relevant and complete.
If the answer is not in the context, say you don't know.

Context:
{context}`;

// Build the store once and reuse it across calls (embedding every request would be wasteful).
let storePromise: Promise<MemoryVectorStore> | null = null;
function getStore(): Promise<MemoryVectorStore> {
  if (!storePromise) storePromise = buildVectorStore();
  return storePromise;
}

// Turn the stored {role, content} history into LangChain message objects.
function toHistoryMessages(history: ChatMessage[]): BaseMessage[] {
  return history.map((m) =>
    m.role === "assistant" ? new AIMessage(m.content) : new HumanMessage(m.content),
  );
}

// AIMessage.content can be a string or an array of content parts; normalise to a string.
function contentToString(content: BaseMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .map((part) => (typeof part === "string" ? part : "text" in part ? part.text : ""))
    .join("");
}

// Retrieve the most relevant chunks for a question.
export async function retrieve(question: string, k: number = RETRIEVAL_K): Promise<Document[]> {
  const store = await getStore();
  const retriever = store.asRetriever(k);
  return retriever.invoke(question);
}

// The core RAG call: retrieve context, stuff it into the system prompt, ask the model.
export async function answer(question: string, history: ChatMessage[] = []): Promise<RagAnswer> {
  if (!hasOpenAIKey()) {
    throw new Error("OPENAI_API_KEY is not set - the RAG pipeline needs it. See .env.example.");
  }

  const docs = await retrieve(question);
  const context = docs
    .map((d) => `Extract from ${d.metadata.source ?? "unknown"}:\n${d.pageContent}`)
    .join("\n\n");

  const llm = new ChatOpenAI({ model: MODEL, temperature: 0.2 });
  const messages: BaseMessage[] = [
    new SystemMessage(SYSTEM_PROMPT.replace("{context}", context)),
    ...toHistoryMessages(history),
    new HumanMessage(question),
  ];

  const reply = await llm.invoke(messages);

  // De-duplicate the source filenames so the UI can show which docs were used.
  const sources = [...new Set(docs.map((d) => String(d.metadata.source ?? "unknown")))];
  return { answer: contentToString(reply.content), sources };
}

async function main(): Promise<void> {
  const question = process.argv.slice(2).join(" ") || "Who won the IIOTY award?";
  if (!hasOpenAIKey()) {
    console.log("OPENAI_API_KEY not set - this demo needs it. See .env.example.");
    console.log(`Would ask: "${question}"`);
    return;
  }
  console.log(`Q: ${question}`);
  const { answer: a, sources } = await answer(question);
  console.log(`\nA: ${a}`);
  console.log(`\nSources: ${sources.join(", ")}`);
}

// Only run the demo when executed directly (npm run ask), not when imported.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
