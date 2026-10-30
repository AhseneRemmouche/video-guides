// Week 6 - The product pricer (TypeScript port of the inference core).
// Given a product description, ask a price-estimating model for a dollar amount
// and parse a number out of the reply.
//
// In the course you build traditional-ML baselines and then fine-tune a frontier
// model through OpenAI's fine-tuning API so it predicts a product's price from its
// description. That heavy lifting stays in Python; this module is only the thin
// inference call the demo UI makes. Point FINE_TUNED_MODEL at your fine-tuned model
// id once you have one; until then it falls back to gpt-4o-mini.
//
// Run with: npm run price -- "<a product description>"   (needs OPENAI_API_KEY)
import "dotenv/config";
import { pathToFileURL } from "node:url";
import OpenAI from "openai";

// The model that estimates the price. Your fine-tuned model id goes in the env var;
// otherwise we use the base mini model so the demo still runs.
export const DEFAULT_MODEL = "gpt-4o-mini";

export function priceModel(): string {
  return process.env.FINE_TUNED_MODEL || DEFAULT_MODEL;
}

// Same spirit as the lab: keep the model terse so the reply is easy to parse.
export const SYSTEM_PROMPT =
  "You estimate the price of the item. Reply only with the price in dollars.";

export function userPromptFor(description: string): string {
  return `How much does this item cost?\n\n${description}`;
}

// A clear error the server turns into a 400 and the CLI prints.
export class MissingKeyError extends Error {
  constructor() {
    super("OPENAI_API_KEY is not set");
    this.name = "MissingKeyError";
  }
}

// Pull the first number out of a reply like "The price is $19.99" or "$1,234.50".
// Strips currency symbols and thousands separators; returns NaN if there is no number.
export function parsePrice(text: string): number {
  // Remove commas used as thousands separators (1,234.50 -> 1234.50).
  const cleaned = text.replace(/,/g, "");
  // First run of digits with an optional decimal part.
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return NaN;
  return Number(match[0]);
}

// --- the core: estimate a price for a product description --------------------
export async function estimatePrice(description: string): Promise<number> {
  if (!process.env.OPENAI_API_KEY) throw new MissingKeyError();

  const openai = new OpenAI(); // reads OPENAI_API_KEY
  const completion = await openai.chat.completions.create({
    model: priceModel(),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPromptFor(description) },
    ],
    // Low ceiling: we only want a number back, not an essay.
    max_tokens: 12,
    temperature: 0,
  });

  const reply = completion.choices[0]?.message.content ?? "";
  return parsePrice(reply);
}

// --- CLI entry point ----------------------------------------------------------
const SAMPLE_DESCRIPTION =
  "Quadcast USB condenser microphone with tap-to-mute sensor, " +
  "built-in anti-vibration shock mount, and RGB lighting. Ideal for " +
  "streaming, podcasting, and gaming.";

async function main(): Promise<void> {
  const description = process.argv.slice(2).join(" ").trim() || SAMPLE_DESCRIPTION;

  if (!process.env.OPENAI_API_KEY) {
    console.log(
      `${new MissingKeyError().message} - this demo needs it. See .env.example.`,
    );
    return;
  }

  console.log(`Estimating with ${priceModel()}...\n`);
  console.log(`Description: ${description}\n`);
  const price = await estimatePrice(description);
  console.log(`Estimated price: $${price.toFixed(2)}`);
}

// Only run when invoked directly (so the file is safe to import for its helpers).
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
