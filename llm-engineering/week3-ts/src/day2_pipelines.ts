// Week 3 - Day 2: HuggingFace pipelines, the transformers.js way.
//
// The Python course uses `from transformers import pipeline`; transformers.js is the
// real JS equivalent: `import { pipeline } from "@huggingface/transformers"`. The API
// is the same shape - call pipeline(task) to get a pipe, then call the pipe with input -
// except it is async (the model downloads on first use) and it runs small ONNX models
// in-process (WASM on CPU), so we name explicit Xenova/* models the library supports.
//
// Run with: npm run day2
// NOTE: the first run downloads each model (tens of MB) from the HuggingFace hub and
// caches it under node_modules/.cache; there is no network use until then.
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { pipeline } from "@huggingface/transformers";

// Small models transformers.js ships ONNX weights for.
const SENTIMENT_MODEL = "Xenova/distilbert-base-uncased-finetuned-sst-2-english";
const SUMMARIZATION_MODEL = "Xenova/distilbart-cnn-6-6";
const QA_MODEL = "Xenova/distilbert-base-cased-distilled-squad";
const ZERO_SHOT_MODEL = "Xenova/nli-deberta-v3-xsmall";

// --- sentiment analysis -------------------------------------------------------
export async function sentimentAnalysis(text: string) {
  const classifier = await pipeline("sentiment-analysis", SENTIMENT_MODEL);
  const result = await classifier(text);
  return result; // [{ label: "POSITIVE", score: 0.99... }]
}

// --- summarization ------------------------------------------------------------
export async function summarize(text: string) {
  const summarizer = await pipeline("summarization", SUMMARIZATION_MODEL);
  // transformers.js types the options as a full GenerationConfig; we only need a couple
  // of fields, so cast the partial options object.
  const options = { max_new_tokens: 60 } as Record<string, unknown>;
  const result = (await summarizer(text, options as any)) as Array<{ summary_text: string }>;
  return result[0]?.summary_text ?? "";
}

// --- question answering -------------------------------------------------------
export async function questionAnswering(question: string, context: string) {
  const qa = await pipeline("question-answering", QA_MODEL);
  const result = await qa(question, context);
  return result; // { answer, score }
}

// --- zero-shot classification -------------------------------------------------
export async function zeroShotClassification(text: string, labels: string[]) {
  const classifier = await pipeline("zero-shot-classification", ZERO_SHOT_MODEL);
  const result = await classifier(text, labels);
  return result; // { labels, scores }
}

async function main(): Promise<void> {
  console.log("=== sentiment-analysis ===");
  console.log(await sentimentAnalysis("I am super excited to be on the way to LLM mastery!"));

  console.log("\n=== summarization ===");
  console.log(
    await summarize(
      "The HuggingFace transformers library is an incredibly versatile and powerful tool " +
        "for natural language processing. It lets you perform a wide range of tasks such as " +
        "text classification, named entity recognition, question answering and summarization. " +
        "It is widely used by the open-source data science community and lowers the barrier to " +
        "entry into the field.",
    ),
  );

  console.log("\n=== question-answering ===");
  console.log(
    await questionAnswering(
      "Who was the 44th president of the United States?",
      "Barack Obama was the 44th president of the United States.",
    ),
  );

  console.log("\n=== zero-shot-classification ===");
  console.log(
    await zeroShotClassification("HuggingFace's Transformers library is amazing!", [
      "technology",
      "sports",
      "politics",
    ]),
  );
}

// Only run when invoked directly (so the file is safe to import for its helpers).
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
