// Lab 02: get typed, validated data back instead of free text.
import { z } from "zod";
import { getModel } from "../src/config.js";

const Format = z.enum(["book", "e-book", "audiobook", "DVD"]);

// What a library visitor is looking for. z.infer turns the schema into a TypeScript type.
const BookRequest = z.object({
  topic: z.string().describe("The subject, in two to four words"),
  audience: z.enum(["children", "teens", "adults"]).describe("Who the book is for"),
  formats: z.array(Format).describe("Formats the visitor accepts"),
  max_pages: z.number().int().nullable().describe("Maximum length if the visitor gives one, else null"),
});
type BookRequest = z.infer<typeof BookRequest>;

const model = getModel();
const structured = model.withStructuredOutput(BookRequest, { name: "BookRequest" });

const requests = [
  "My 8-year-old loves crabs and the beach. Anything short, under 40 pages? Paper or e-book is fine.",
  "I'd like an audiobook on the history of our harbor for my commute.",
];
for (const text of requests) {
  const result: BookRequest = await structured.invoke(text);
  console.log(typeof result, result);
}

// includeRaw: true also returns the raw AIMessage and the parsed value, so a failure does not throw.
const vague = "Something fun to read.";
const raw = await model.withStructuredOutput(BookRequest, { name: "BookRequest", includeRaw: true }).invoke(vague);
console.log("\nincludeRaw keys:", Object.keys(raw));
console.log("parsed:", raw.parsed);
console.log("output tokens:", (raw.raw as { usage_metadata?: { output_tokens: number } }).usage_metadata?.output_tokens);

// A schema can also limit size: .max(4) becomes "maxItems" in the JSON schema, which Ollama enforces.
const BookRequestV2 = BookRequest.extend({ formats: z.array(Format).max(4).describe("Formats the visitor accepts") });
const fixed = await model.withStructuredOutput(BookRequestV2, { name: "BookRequest", includeRaw: true }).invoke(vague);
console.log("\nwith .max(4):", fixed.parsed);
