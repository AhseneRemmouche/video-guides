# LLM Engineering - Week 6 (TypeScript + React)

A TypeScript + React port of the inference demo for **Week 6** of Ed Donner's
*LLM Engineering* course: **the product pricer**. Describe a product and a model
estimates what it costs.

In the course, Week 6 is where you curate a large product dataset, build
traditional-ML baselines (feature engineering, linear regression, bag-of-words,
word2vec, etc.), and then **fine-tune a frontier model through OpenAI's
fine-tuning API** so it predicts a product's price from its description. All of
that data and training work stays in Python. This repo is only the thin
**inference demo UI** that calls the resulting price-estimating model.

Point `FINE_TUNED_MODEL` at your fine-tuned model id once you have one
(e.g. `ft:gpt-4o-mini-2024-07-18:personal::XXXX`); until then it falls back to the
base `gpt-4o-mini` so the demo still runs.

## Layout

| Path | What it is |
| --- | --- |
| `src/price.ts` | `estimatePrice(description)` - calls OpenAI chat and parses a number out of the reply. Exports a pure `parsePrice(text)` helper. Key-guarded. |
| `server/index.ts` | Hono API: `POST /api/price {description}` -> `{price}`; 400 JSON if the key is missing. |
| `web/` | Vite + React 19 UI: a description textarea, an Estimate price button, the price shown big. |

## Setup

```bash
npm install
cp .env.example .env   # add OPENAI_API_KEY (and FINE_TUNED_MODEL if you have one)
```

## Run

```bash
# CLI: price the built-in sample product (or pass your own description)
npm run price
npm run price -- "Noise-cancelling over-ear bluetooth headphones, 30h battery"

# Web UI (two terminals): the API, then the Vite dev server
npm run api     # Hono on http://localhost:8788
npm run web     # Vite on http://localhost:5173 (proxies /api -> 8788)
```

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run build       # typecheck + vite build
```

Everything is key-guarded, so it compiles and builds without an API key; the OpenAI
call only happens once you supply `OPENAI_API_KEY` and click Estimate price.

### `parsePrice`

`parsePrice(text)` is a pure function (no network): it strips currency symbols and
thousands separators and returns the first number it finds, e.g.
`parsePrice("The price is $19.99")` returns `19.99`. Returns `NaN` when the reply
has no number.
