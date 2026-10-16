// Week 1 Day 3 — many models, one question, one judge (TypeScript version of 1_foundations/2_lab2.ipynb)
import Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";
import { z } from "zod";
import { LOCAL, compatibleClient, model, openai } from "./setup.js";

const request =
  "Please come up with a challenging, nuanced question that I can ask a number of LLMs to evaluate their intelligence. " +
  "Answer only with the question, no explanation.";
let response = await openai.chat.completions.create({ model: model("gpt-5-mini"), messages: [{ role: "user", content: request }] });
const question = response.choices[0]!.message.content ?? "";
console.log(question);

const competitors: string[] = [];
const answers: string[] = [];
const messages: OpenAI.ChatCompletionMessageParam[] = [{ role: "user", content: question }];

/** Ask one competitor through an OpenAI-compatible client and record its answer. Missing keys are skipped. */
async function ask(name: string, client: OpenAI, modelName: string) {
  try {
    const r = await client.chat.completions.create({ model: model(modelName), messages });
    competitors.push(LOCAL ? `${modelName} (local stand-in)` : modelName);
    answers.push(r.choices[0]!.message.content ?? "");
    console.log(`--- ${name} answered`);
  } catch (e) {
    console.log(`--- ${name} skipped: ${(e as Error).message.slice(0, 80)}`);
  }
}

await ask("OpenAI", openai, "gpt-5-nano");

// Anthropic has its own SDK (no OpenAI-compatible endpoint): messages.create needs max_tokens
if (process.env.ANTHROPIC_API_KEY && !LOCAL) {
  const claude = new Anthropic();
  const r = await claude.messages.create({ model: "claude-sonnet-4-5", messages: [{ role: "user", content: question }], max_tokens: 1000 });
  const block = r.content[0];
  competitors.push("claude-sonnet-4-5");
  answers.push(block?.type === "text" ? block.text : "");
}

await ask("Gemini", compatibleClient("https://generativelanguage.googleapis.com/v1beta/openai/", process.env.GOOGLE_API_KEY), "gemini-2.5-flash");
await ask("DeepSeek", compatibleClient("https://api.deepseek.com/v1", process.env.DEEPSEEK_API_KEY), "deepseek-chat");
await ask("Groq", compatibleClient("https://api.groq.com/openai/v1", process.env.GROQ_API_KEY), "openai/gpt-oss-120b");
await ask("Ollama", compatibleClient("http://localhost:11434/v1", "ollama"), "llama3.2");

// Put all the answers together, numbered, for the judge
let together = "";
answers.forEach((a, i) => (together += `# Response from competitor ${i + 1}\n\n${a}\n\n`));

const judge = `You are judging a competition between ${competitors.length} competitors.
Each model has been given this question:

${question}

Your job is to evaluate each response for clarity and strength of argument, and rank them in order of best to worst.
Respond with JSON, and only JSON, with the following format:
{"results": ["best competitor number", "second best competitor number", "third best competitor number", ...]}

Here are the responses from each competitor:

${together}

Now respond with the JSON with the ranked order of the competitors, nothing else. Do not include markdown formatting or code blocks.`;

response = await openai.chat.completions.create({ model: model("gpt-5-mini"), messages: [{ role: "user", content: judge }] });
const results = response.choices[0]!.message.content ?? "";
console.log(results);

// Validate the judge's JSON instead of trusting it: small models answer "competitor 2" instead of "2"
const Ranking = z.object({ results: z.array(z.union([z.string(), z.number()])) });
const ranks = Ranking.parse(JSON.parse(results)).results;
ranks.forEach((r, i) => {
  const n = Number(String(r).match(/\d+/)?.[0]);
  console.log(`Rank ${i + 1}: ${competitors[n - 1] ?? `unknown (${r})`}`);
});
