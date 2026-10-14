// Tests that need no model, no key and no network: run them with `pnpm test`.
// A scripted fake model replaces OpenAI/Ollama, a canned result replaces Tavily, and every lesson
// and chef file runs end to end, like the Python verification harness.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { format } from "node:util";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { callTool, ScriptedChatModel } from "./fake-model.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const FRIDGE = path.join(ROOT, "data", "fridge.png");

const fake = vi.hoisted(() => ({
  model: undefined as unknown,
  searches: [] as string[],
  answers: [] as string[], // what the fake terminal "types" for readline questions
}));

// Every file gets the fake model, whichever way it asks for one.
vi.mock("../src/models.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/models.js")>()),
  PROVIDER: "ollama", // skips main.ts's OPENAI_API_KEY check
  MODEL_ID: "fake-model",
  getModel: () => fake.model,
  getVisionModel: () => fake.model,
}));
vi.mock("langchain", async (importOriginal) => {
  const real = await importOriginal<typeof import("langchain")>();
  return {
    ...real,
    initChatModel: async () => fake.model,
    createAgent: ((params: Parameters<typeof real.createAgent>[0]) =>
      real.createAgent({ ...params, model: typeof params.model === "string" ? (fake.model as never) : params.model })) as typeof real.createAgent,
  };
});
// A canned Tavily: no network.
vi.mock("@langchain/tavily", () => ({
  TavilySearch: class {
    async invoke({ query }: { query: string }) {
      fake.searches.push(query);
      return { query, results: [{ title: "Tomato and egg stir-fry", url: "https://example.com/tomato-egg", content: "CANNED-SEARCH-RESULT" }] };
    }
  },
}));
vi.mock("node:readline/promises", () => ({
  createInterface: () => ({ question: async () => fake.answers.shift() ?? "q", close: () => {} }),
}));
// chat-chef reads lines with `for await (const line of terminal)` from node:readline
vi.mock("node:readline", () => ({
  createInterface: () => ({
    on: () => {},
    prompt: () => {},
    close: () => {},
    async *[Symbol.asyncIterator]() {
      while (fake.answers.length) yield fake.answers.shift()!;
      yield "q";
    },
  }),
}));

const RECIPE = {
  title: "Tomato egg stir-fry",
  ingredients_seen: ["tomato", "eggs"],
  ingredients: ["2 tomatoes", "3 eggs", "salt"],
  steps: ["Beat the eggs.", "Cook the tomatoes.", "Add the eggs and stir."],
  minutes: 15,
  source_url: "https://example.com/tomato-egg",
};

let output: string[];
let logs: string[];

beforeEach(() => {
  vi.resetModules(); // each test runs its script again, from the top
  process.env.TAVILY_API_KEY = "test-key-not-real"; // the canned Tavily is used
  fake.searches = [];
  fake.answers = [];
  output = [];
  logs = [];
  vi.spyOn(console, "log").mockImplementation((...args) => void output.push(format(...args)));
  vi.spyOn(console, "error").mockImplementation((...args) => void logs.push(format(...args)));
  vi.spyOn(process.stdout, "write").mockImplementation((text) => (output.push(String(text)), true));
});
afterEach(() => vi.restoreAllMocks());

function useModel(model: ScriptedChatModel) {
  fake.model = model;
  return model;
}

/** Run a lesson or chef file as `pnpm lesson`/`pnpm chef` would, with optional command-line arguments. */
async function run(file: string, ...args: string[]) {
  process.argv = [process.argv[0], path.join(ROOT, file), ...args];
  await import(/* @vite-ignore */ `../${file}`);
  return output.join("");
}

const kinds = (messages: BaseMessage[]) => messages.map((m) => m.type);

describe("lessons run end to end", () => {
  test("04 a model answers a prompt", async () => {
    const model = useModel(new ScriptedChatModel([new AIMessage("Once upon a time...")]));
    expect(await run("lessons/04-models-agents.ts")).toContain("Once upon a time...");
    expect(model.calls[0][0].text).toBe("tell me story");
  });

  test("05 an agent around the model", async () => {
    useModel(new ScriptedChatModel([new AIMessage("Rome.")]));
    expect(await run("lessons/05-models-agents.ts")).toContain("Rome.");
  });

  test("06 the model receives the whole conversation", async () => {
    const model = useModel(new ScriptedChatModel([new AIMessage("Rome has 2,700 years of history.")]));
    expect(await run("lessons/06-models-agents.ts")).toContain("2,700 years");
    expect(kinds(model.calls[0])).toEqual(["human", "ai", "human"]);
  });

  test("07 streaming prints the answer piece by piece", async () => {
    useModel(new ScriptedChatModel([new AIMessage("Rome is the capital of Italy.")]));
    const text = await run("lessons/07-models-agents.ts");
    expect(text).toBe("Rome is the capital of Italy.");
    expect(output.length).toBeGreaterThan(1); // several pieces, not one block
  });

  test("08 tool-call trace: human, ai + tool_calls, tool, ai", async () => {
    useModel(new ScriptedChatModel([callTool("print_document", { name: "Luca" }), new AIMessage("Here is your document.")]));
    const text = await run("lessons/08-tools.ts");
    expect(text).toContain("Here is your document.");
    expect(text).toContain("this is the document of Luca");
  });

  test("09 web search with the canned Tavily result", async () => {
    const model = useModel(new ScriptedChatModel([callTool("web_search", { query: "news today" }), new AIMessage("Top story...")]));
    const text = await run("lessons/09-tools.ts");
    expect(text).toContain("we are doing some research on news today");
    expect(fake.searches).toEqual(["news today"]);
    expect(model.calls[1].at(-1)!.text).toContain("CANNED-SEARCH-RESULT");
  });

  test("09 without TAVILY_API_KEY the tool answers instead of crashing", async () => {
    process.env.TAVILY_API_KEY = "";
    const model = useModel(new ScriptedChatModel([callTool("web_search", { query: "news today" }), new AIMessage("I can't search.")]));
    await run("lessons/09-tools.ts");
    expect(fake.searches).toEqual([]);
    expect(model.calls[1].at(-1)!.text).toBe("Web search is not configured (no TAVILY_API_KEY).");
  });

  test("10-before: without a checkpointer the second call forgets", async () => {
    const model = useModel(new ScriptedChatModel([new AIMessage("Nice!"), new AIMessage("I don't know.")]));
    await run("lessons/10-in-memory-agent-before.ts");
    expect(kinds(model.calls[1])).toEqual(["human"]);
  });

  test("10: with MemorySaver and a thread_id the second call remembers", async () => {
    const model = useModel(new ScriptedChatModel([new AIMessage("Nice!"), new AIMessage("Green.")]));
    expect(await run("lessons/10-in-memory-agent.ts")).toContain("Green.");
    expect(kinds(model.calls[1])).toEqual(["human", "ai", "human"]);
  });

  test("11 the image travels as a base64 data URL", async () => {
    const model = useModel(new ScriptedChatModel([new AIMessage("A fridge shelf.")]));
    expect(await run("lessons/11-multi-model-messages.ts", FRIDGE)).toContain("A fridge shelf.");
    const [text, image] = model.calls[0][0].content as Array<Record<string, any>>;
    expect(text).toEqual({ type: "text", text: "tell me what is the image about" });
    expect(image.type).toBe("image_url");
    expect(image.image_url.url).toMatch(/^data:image\/png;base64,iVBORw0KGgo/);
  });

  test("11 asks for a path when none is given", async () => {
    fake.answers = [`"${FRIDGE}"`]; // quotes are removed, like the Python version
    useModel(new ScriptedChatModel([new AIMessage("A fridge shelf.")]));
    expect(await run("lessons/11-multi-model-messages.ts")).toContain("A fridge shelf.");
  });
});

describe("chef runs end to end", () => {
  test("main: the fixed prompts reach the model, the search runs, logs look like Python's", async () => {
    const model = useModel(new ScriptedChatModel([
      callTool("web_search", { query: "tomato egg recipe" }),
      new AIMessage("Tomato egg stir-fry: beat the eggs..."),
    ]));
    const { CHEF_PROMPT, SYSTEM_CHEF_PROMPT } = await import("../chef/prompt.js");
    expect(await run("chef/main.ts", FRIDGE)).toContain("Tomato egg stir-fry");

    const [system, human] = model.calls[0];
    expect(system).toBeInstanceOf(SystemMessage);
    expect(system.text).toBe(SYSTEM_CHEF_PROMPT);
    expect(system.text).not.toContain("photo.once");
    expect((human.content as Array<{ text?: string }>)[0].text).toBe(CHEF_PROMPT); // not the word "prompt"
    expect(model.calls[1].at(-1)).toBeInstanceOf(ToolMessage);
    expect(fake.searches).toEqual(["tomato egg recipe"]);
    expect(logs.some((l) => /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d,\d{3} \| INFO \| searching for tomato egg recipe$/.test(l))).toBe(true);
    expect(logs.map((l) => l.split(" | ").slice(1).join(" | "))).toEqual([
      "INFO | creating our agent...",
      "INFO | choosing our image...",
      "INFO | invoking our agent...",
      "INFO | searching for tomato egg recipe",
    ]);
  });

  test("structured-chef with toolStrategy (models without native JSON schema, e.g. Ollama)", async () => {
    const model = useModel(new ScriptedChatModel([callTool("Recipe", RECIPE)]));
    const text = await run("chef/structured-chef.ts", FRIDGE);
    expect(text).toContain("# Tomato egg stir-fry  (15 min)");
    expect(text).toContain(" 3. Add the eggs and stir.");
    const toolNames = model.boundTools.map((t) => (t as { name?: string; function?: { name: string } }).name ?? (t as { function: { name: string } }).function.name);
    expect(toolNames).toEqual(["web_search", "Recipe"]);
    expect(model.boundOptions.tool_choice).toBe("any");
  });

  test("structured-chef with providerStrategy (models with native JSON schema, e.g. OpenAI)", async () => {
    const model = useModel(new ScriptedChatModel([new AIMessage(JSON.stringify(RECIPE))], true));
    expect(await run("chef/structured-chef.ts", FRIDGE)).toContain("Source: https://example.com/tomato-egg");
    expect(model.boundOptions.response_format).toMatchObject({ type: "json_schema", json_schema: { strict: true } });
  });

  test("chat-chef streams only AI text and remembers the conversation", async () => {
    fake.answers = ["and without eggs?", "q"];
    const model = useModel(new ScriptedChatModel([
      callTool("web_search", { query: "tomato egg recipe" }),
      new AIMessage("Make a tomato omelette."),
      new AIMessage("Then a tomato salad."),
    ]));
    const text = await run("chef/chat-chef.ts", FRIDGE);
    expect(text).toContain("Make a tomato omelette.");
    expect(text).toContain("Then a tomato salad.");
    expect(text).not.toContain("CANNED-SEARCH-RESULT"); // the tool result is not printed
    expect(kinds(model.calls[2])).toEqual(["system", "human", "ai", "tool", "ai", "human"]);
  });

  test("main-any-model builds the agent from a provider:model string", async () => {
    useModel(new ScriptedChatModel([new AIMessage("Any model works.")]));
    expect(await run("chef/main-any-model.ts", FRIDGE)).toContain("Any model works.");
  });
});

describe("building blocks", () => {
  test("image data URL: mime type from the extension, clear errors", async () => {
    const { imageToDataUrl } = await import("../chef/photo-decoder.js");
    const dir = mkdtempSync(path.join(tmpdir(), "chef-"));
    writeFileSync(path.join(dir, "a.JPG"), Buffer.from([0xff, 0xd8, 0xff]));
    writeFileSync(path.join(dir, "notes.txt"), "hello");
    expect(imageToDataUrl(path.join(dir, "a.JPG"))).toBe("data:image/jpeg;base64,/9j/");
    expect(() => imageToDataUrl(path.join(dir, "notes.txt"))).toThrow(/^Not an image file: /);
    expect(() => imageToDataUrl(path.join(dir, "missing.png"))).toThrow(/^Image not found: /);
  });

  test("web search without a key returns a message", async () => {
    process.env.TAVILY_API_KEY = "";
    const { webSearch } = await import("../chef/tools.js");
    expect(await webSearch.invoke({ query: "pasta" })).toBe(
      "Web search is not configured (no TAVILY_API_KEY). Answer from what you already know.",
    );
  });

  test("a checkpointer without thread_id fails with a clear error", async () => {
    const { createAgent } = await import("langchain");
    const agent = createAgent({ model: new ScriptedChatModel([new AIMessage("hi")]), checkpointer: new MemorySaver() });
    await expect(agent.invoke({ messages: [new HumanMessage("hi")] })).rejects.toThrow(
      'Failed to put checkpoint. The passed RunnableConfig is missing a required "thread_id" field in its "configurable" property.',
    );
  });

  test("LangChain.js sends temperature as given, even to gpt-5 models", () => {
    // Python's langchain-openai drops it for gpt-5 models; @langchain/openai 1.6.2 passes it on.
    const model = new ChatOpenAI({ model: "gpt-5-nano", temperature: 0, apiKey: "not-a-real-key" });
    expect(model.invocationParams({}).temperature).toBe(0);
    expect(new ChatOpenAI({ model: "gpt-5-nano", apiKey: "not-a-real-key" }).invocationParams({}).temperature).toBeUndefined();
  });

  test("upload check: type, size, base64", async () => {
    const { checkUpload } = await import("../server/upload.js");
    expect(checkUpload({ mimeType: "image/png", data: "iVBORw0KGgo=" })).toEqual({ dataUrl: "data:image/png;base64,iVBORw0KGgo=" });
    expect(checkUpload({ mimeType: "application/pdf", data: "AAAA" })).toEqual({
      error: 'Please send a photo (PNG, JPEG, WebP or GIF), not "application/pdf".',
    });
    expect(checkUpload({ mimeType: "image/png", data: "not base64!" })).toHaveProperty("error");
    expect(checkUpload({ mimeType: "image/jpeg", data: "A".repeat(7 * 1024 * 1024) })).toEqual({
      error: "The photo is 5.3 MB; the limit is 5 MB.",
    });
  });
});

describe("web server", () => {
  /** Read an SSE answer into [event, data] pairs. */
  async function readEvents(response: Response) {
    const text = await response.text();
    return text.split(/\r?\n\r?\n/).filter(Boolean).map((block) => [
      block.match(/^event: (.*)$/m)?.[1],
      JSON.parse(block.match(/^data: (.*)$/m)?.[1] ?? "null"),
    ] as const);
  }

  test("photo upload: ingredients, tool calls and streamed answer; then a follow-up on the same thread", async () => {
    const model = useModel(new ScriptedChatModel((messages, call) => [
      new AIMessage("tomato\neggs"), // the vision model reads the photo
      callTool("web_search", { query: "tomato egg recipe" }),
      new AIMessage("Tomato egg stir-fry."),
      new AIMessage("Yes, use oil instead."),
    ][call]));
    const { app } = await import("../server/app.js");
    const post = (url: string, body: unknown) =>
      app.request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

    const data = (await import("node:fs")).readFileSync(FRIDGE).toString("base64");
    const first = await readEvents(await post("/api/photo", { threadId: "t1", mimeType: "image/png", data }));
    expect(first[0]).toEqual(["ingredients", "tomato\neggs"]);
    expect(first).toContainEqual(["tool_call", { id: "call_web_search", name: "web_search", args: { query: "tomato egg recipe" } }]);
    expect(first.find(([e]) => e === "tool_result")?.[1].content).toContain("CANNED-SEARCH-RESULT");
    expect(first.filter(([e]) => e === "token").map(([, d]) => d).join("")).toBe("Tomato egg stir-fry.");
    expect(first.at(-1)).toEqual(["done", {}]);

    const second = await readEvents(await post("/api/chat", { threadId: "t1", message: "can I skip butter?" }));
    expect(second.filter(([e]) => e === "token").map(([, d]) => d).join("")).toBe("Yes, use oil instead.");
    expect(kinds(model.calls[3])).toEqual(["system", "human", "ai", "tool", "ai", "human"]); // memory
  });

  test("a non-image upload is refused with a clear message", async () => {
    const { app } = await import("../server/app.js");
    const response = await app.request("/api/photo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ threadId: "t2", mimeType: "text/plain", data: "aGVsbG8=" }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Please send a photo (PNG, JPEG, WebP or GIF), not "text/plain".' });
  });
});
