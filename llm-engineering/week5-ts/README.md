# LLM Engineering - Week 5 (TypeScript + React)

A TypeScript + React port of **Week 5** of Ed Donner's LLM Engineering course:
**RAG - retrieval-augmented generation with LangChain**. The Python course built a
"knowledge worker" that answers questions about the fictional insurtech company
*Insurellm* by retrieving relevant chunks from a knowledge base and feeding them to
the model. Gradio is replaced with a small React chat app, which is the whole point.

Model names are the video-era ones: `gpt-4o-mini` for chat and
`text-embedding-3-small` for embeddings.

## How it maps to the Python labs

| Python lab | What it did | Here |
|------------|-------------|------|
| day1 | DIY RAG: load docs, naive keyword context stuffing | the `knowledge/` loader + system-prompt context |
| day2/day3 | LangChain `DirectoryLoader` + `CharacterTextSplitter` + `OpenAIEmbeddings` + Chroma | `src/ingest.ts` (`RecursiveCharacterTextSplitter` + `MemoryVectorStore`) |
| day4/day5 | retriever + LLM + history (knowledge-worker chat) | `src/rag.ts` `answer(question, history)` |

Instead of Chroma/FAISS (which need native modules or a server) this port uses
LangChain.js's in-memory `MemoryVectorStore`, so there are no native dependencies.

## Setup

```bash
npm install          # node 24 / npm 12
cp .env.example .env # then add your OPENAI_API_KEY
```

If npm's script sandbox blocks esbuild's postinstall, run:

```bash
npm install-scripts approve esbuild
```

## The labs (run with tsx)

| Script          | File             | What it shows |
|-----------------|------------------|---------------|
| `npm run ingest`| `src/ingest.ts`  | Load the sample docs from `knowledge/`, split them into chunks, embed with `text-embedding-3-small`, and build the in-memory vector store. Reports counts. |
| `npm run ask`   | `src/rag.ts`     | Run the full RAG pipeline for a question: retrieve context, call `gpt-4o-mini`, print the answer and the sources used. `npm run ask "How much is Carllm?"` |

Both need `OPENAI_API_KEY` at runtime (embeddings + chat). With no key they print a
clear message and exit without calling OpenAI.

## The knowledge base

Three tiny sample docs under `knowledge/`, grouped by type the way the course did:

- `company/about.md` - what Insurellm is and its products
- `products/carllm.md` - the Carllm car-insurance product and its pricing
- `employees/avery-lancaster.md` - the CEO (who won the IIOTY award)

Add your own `.md` / `.txt` files under `knowledge/<type>/` and re-run `ingest`.

## The knowledge-worker app (React, replacing Gradio)

```bash
npm run api   # terminal 1: Hono API on http://localhost:8788
npm run web   # terminal 2: Vite dev server on http://localhost:5173 (proxies /api)
```

- `POST /api/ask` `{question, history?}` -> `{answer, sources}`

The React app **never imports langchain** - it only `fetch`es the API - so the browser
bundle stays tiny and vite never tries to bundle the RAG stack. With no `OPENAI_API_KEY`
the route returns a clear `400` JSON error instead of crashing.

## Build

```bash
npm run typecheck   # tsc --noEmit
npm run build       # tsc --noEmit && vite build  -> web/dist
```

After `npm run build`, `npm run api` also serves the built app from `web/dist`.
