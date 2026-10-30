# LLM Engineering - Week 3 (TypeScript + React)

A TypeScript + React port of **Week 3** of Ed Donner's LLM Engineering course:
*Open-Source Gen AI with HuggingFace*. The Python course runs HuggingFace
`transformers` on a Google Colab GPU; this port uses
**[@huggingface/transformers](https://www.npmjs.com/package/@huggingface/transformers)**
(transformers.js) - the real JS equivalent - which runs small ONNX models in-process
(WASM on CPU), so it needs no GPU and no API key. Gradio is replaced with a small
React app, which is the whole point.

Models download from the HuggingFace hub on first use and are cached under
`node_modules/.cache`; there is no network use until you actually call a pipeline.

## Setup

```bash
npm install          # node 24 / npm 12
cp .env.example .env # optional - only for a HuggingFace token (gated repos / rate limits)
```

If npm's script sandbox blocks esbuild's postinstall, run:

```bash
npm install-scripts approve esbuild
```

## The labs (run with tsx)

| Script          | File                      | What it shows |
|-----------------|---------------------------|---------------|
| `npm run day2`  | `src/day2_pipelines.ts`   | transformers.js `pipeline(...)`: sentiment-analysis, summarization, question-answering and zero-shot-classification, with small `Xenova/*` models. |
| `npm run day3`  | `src/day3_tokenizers.ts`  | `AutoTokenizer.from_pretrained(...)`: encode/decode, per-token decode, chat templates, and a code tokenizer (Starcoder2). |

Both labs download their models/tokenizers from the hub on first run.

## The web app (React, replacing Gradio)

```bash
npm run api   # terminal 1: Hono API on http://localhost:8789
npm run web   # terminal 2: Vite dev server on http://localhost:5174 (proxies /api)
```

- `POST /api/analyze` `{ text, task? }` - runs a transformers.js pipeline server-side
  (`task: "sentiment"` default, or `"summary"`) and returns the result. The model is
  lazy-loaded on the first request, so that first call is the slow one.

## Build

```bash
npm run typecheck   # tsc --noEmit
npm run build       # tsc --noEmit && vite build  -> web/dist
```

After `npm run build`, `npm run api` also serves the built app from `web/dist`.

### Note on bundling transformers.js

`@huggingface/transformers` is a large, server-oriented library (it ships WASM/ONNX
runtimes and reads from the filesystem cache). The React app never imports it directly -
it only `fetch`es the Hono API - so Vite never tries to bundle it for the browser, and
`vite build` stays clean. The library is used only in the Node processes (`day2`, `day3`,
`api`), where tsx/Node load it natively.
