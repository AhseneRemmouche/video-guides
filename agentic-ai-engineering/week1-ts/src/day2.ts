// Day 2 (Lab 2) - many LLMs through ONE client, then an LLM judge.
// TS port of 2_lab2.py. The trick: every provider below copied OpenAI's HTTP
// shape, so the same `openai` client library talks to all of them - you only
// change `baseURL` + `apiKey`. We ask them all the same question, then have a
// final model rank the answers (an "LLM as judge" pattern).
import "dotenv/config";
import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  console.log("OPENAI_API_KEY not set - add it to your .env (see .env.example).");
  process.exit(0);
}

const openai = new OpenAI();

// One competitor = a label plus a ready-to-call client and its model id.
interface Competitor {
  name: string;
  client: OpenAI;
  model: string;
}

async function ask(client: OpenAI, model: string, content: string): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content }],
  });
  return response.choices[0]?.message.content ?? "";
}

async function main() {
  // 1) Have OpenAI invent a nuanced question we can pose to everyone.
  const request =
    "Please come up with a challenging, nuanced question that I can ask a number " +
    "of LLMs to evaluate their intelligence. Answer only with the question, no explanation.";
  const question = await ask(openai, "gpt-4o-mini", request);
  console.log("Question:\n", question, "\n");

  // 2) Assemble the field of competitors. Each is the SAME client class, only
  //    pointed at a different OpenAI-compatible endpoint. Any whose key is
  //    missing is simply skipped, so this runs with whatever you have.
  const competitors: Competitor[] = [{ name: "gpt-4o-mini", client: openai, model: "gpt-4o-mini" }];

  if (process.env.ANTHROPIC_API_KEY) {
    competitors.push({
      name: "claude-3-7-sonnet-latest",
      client: new OpenAI({
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseURL: "https://api.anthropic.com/v1/",
      }),
      model: "claude-3-7-sonnet-latest",
    });
  }
  if (process.env.GOOGLE_API_KEY) {
    competitors.push({
      name: "gemini-2.0-flash",
      client: new OpenAI({
        apiKey: process.env.GOOGLE_API_KEY,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      }),
      model: "gemini-2.0-flash",
    });
  }
  if (process.env.DEEPSEEK_API_KEY) {
    competitors.push({
      name: "deepseek-chat",
      client: new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: "https://api.deepseek.com/v1",
      }),
      model: "deepseek-chat",
    });
  }
  if (process.env.GROQ_API_KEY) {
    competitors.push({
      name: "llama-3.3-70b-versatile",
      client: new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: "https://api.groq.com/openai/v1",
      }),
      model: "llama-3.3-70b-versatile",
    });
  }

  // 3) Collect each competitor's answer to the one question.
  const names: string[] = [];
  const answers: string[] = [];
  for (const c of competitors) {
    const answer = await ask(c.client, c.model, question);
    names.push(c.name);
    answers.push(answer);
    console.log(`Competitor: ${c.name}\n\n${answer}\n`);
  }

  // 4) Bundle the answers and ask a judge model to rank them. We request pure
  //    JSON so the result is machine-readable.
  let together = "";
  answers.forEach((answer, index) => {
    together += `# Response from competitor ${index + 1}\n\n${answer}\n\n`;
  });

  const judgePrompt =
    `You are judging a competition between ${names.length} competitors.\n` +
    `Each model has been given this question:\n\n${question}\n\n` +
    "Your job is to evaluate each response for clarity and strength of argument, " +
    "and rank them in order of best to worst.\n" +
    'Respond with JSON, and only JSON, with the following format:\n' +
    '{"results": ["best competitor number", "second best competitor number", ...]}\n\n' +
    `Here are the responses from each competitor:\n\n${together}\n` +
    "Now respond with the JSON with the ranked order of the competitors, nothing else. " +
    "Do not include markdown formatting or code blocks.";

  const results = await ask(openai, "o3-mini", judgePrompt);
  console.log("Judge raw result:\n", results, "\n");

  // 5) Turn the ranked competitor numbers back into names.
  const ranks = (JSON.parse(results) as { results: string[] }).results;
  ranks.forEach((result, index) => {
    console.log(`Rank ${index + 1}: ${names[Number(result) - 1]}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
