// Week 4 - Code generation (TypeScript port of day3.py / day4.py)
// Send slow Python to a frontier model and ask for a high-performance C++ rewrite,
// streaming the C++ back as it is generated.
//   - GPT-4o    via the openai client library
//   - Claude    via the native @anthropic-ai/sdk (claude-3-5-sonnet-20240620)
//
// The original lab also compiled + ran the C++ to compare speed against Python; that part
// is machine-specific (it shells out to clang++), so here we focus on the model-driven port,
// which is the reusable core the UI calls.
//
// Run with: npm run optimize    (needs the key for the chosen model; see .env.example)
import "dotenv/config";
import { pathToFileURL } from "node:url";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// Video-era model ids (the lab pins these for reproducible results).
export const GPT_MODEL = "gpt-4o";
export const CLAUDE_MODEL = "claude-3-5-sonnet-20240620";

// The UI dropdown picks one of these.
export type Model = "gpt-4o" | "claude";

// A representative compile command, handed to the model so it tunes the C++ for it.
// (The lab targets the fastest possible runtime with aggressive optimisation flags.)
const COMPILE_COMMAND =
  "clang++ -std=c++17 -O3 -march=native -DNDEBUG main.cpp -o main";

// Same instruction the Python lab uses: C++ only, identical output, fastest time.
export const SYSTEM_PROMPT =
  "Your task is to convert Python code into high performance C++ code. " +
  "Respond only with C++ code. Do not provide any explanation other than occasional comments. " +
  "The C++ response needs to produce an identical output in the fastest possible time.";

export function userPromptFor(python: string): string {
  return (
    "Port this Python code to C++ with the fastest possible implementation that produces " +
    "identical output in the least time. Pay attention to integer and floating-point types " +
    "to make sure the results match, and watch for overflow.\n" +
    "Your response will be written to a file called main.cpp and then compiled and executed; " +
    `the compilation command is:\n${COMPILE_COMMAND}\n` +
    "Respond only with C++ code. Do not wrap it in markdown fences.\n\n" +
    "Python code to port:\n\n" +
    "```python\n" +
    python +
    "\n```\n"
  );
}

// --- clients (built lazily so the module imports fine with no keys) ------------
function hasKeyFor(model: Model): boolean {
  return model === "gpt-4o" ? !!process.env.OPENAI_API_KEY : !!process.env.ANTHROPIC_API_KEY;
}

// A clear error the server turns into a 400 and the CLI prints.
export class MissingKeyError extends Error {
  constructor(public readonly model: Model) {
    super(
      model === "gpt-4o"
        ? "OPENAI_API_KEY is not set"
        : "ANTHROPIC_API_KEY is not set",
    );
    this.name = "MissingKeyError";
  }
}

// Strip stray markdown code fences the model may still emit, mirroring the Python
// `reply.replace('```cpp','').replace('```','')` cleanup.
export function stripCodeFences(text: string): string {
  return text.replace(/```(?:cpp|c\+\+)?/gi, "");
}

// --- the core: stream a C++ port of the given Python -------------------------
// Yields chunks of C++ as they arrive, mirroring the Gradio `yield` loop.
export async function* optimizePython(python: string, model: Model): AsyncGenerator<string> {
  if (!hasKeyFor(model)) throw new MissingKeyError(model);

  if (model === "gpt-4o") {
    const openai = new OpenAI(); // reads OPENAI_API_KEY
    const stream = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPromptFor(python) },
      ],
      stream: true,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta.content ?? "";
      if (delta) yield delta;
    }
  } else {
    const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY
    const stream = anthropic.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPromptFor(python) }],
    });
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  }
}

// Convenience: collect the whole (fence-stripped) C++ port.
export async function optimizePythonToString(python: string, model: Model): Promise<string> {
  let out = "";
  for await (const chunk of optimizePython(python, model)) out += chunk;
  return stripCodeFences(out);
}

// --- CLI entry point ----------------------------------------------------------
// A slow pi-calculation in Python (the lab's running example).
const SAMPLE_PYTHON = `import time

def calculate(iterations, param1, param2):
    result = 1.0
    for i in range(1, iterations+1):
        j = i * param1 - param2
        result -= (1/j)
        j = i * param1 + param2
        result += (1/j)
    return result

start_time = time.time()
result = calculate(100_000_000, 4, 1) * 4
end_time = time.time()

print(f"Result: {result:.12f}")
print(f"Execution Time: {(end_time - start_time):.6f} seconds")
`;

async function main(): Promise<void> {
  const model = (process.argv[2] as Model) ?? "gpt-4o";
  if (model !== "gpt-4o" && model !== "claude") {
    console.log('Usage: npm run optimize -- [gpt-4o|claude]');
    return;
  }
  if (!hasKeyFor(model)) {
    console.log(
      `${new MissingKeyError(model).message} - this demo needs it. See .env.example.`,
    );
    return;
  }
  console.log(`Optimising the sample Python with ${model}...\n`);
  for await (const chunk of optimizePython(SAMPLE_PYTHON, model)) {
    process.stdout.write(chunk);
  }
  process.stdout.write("\n");
}

// Only run when invoked directly (so the file is safe to import for its helpers).
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
