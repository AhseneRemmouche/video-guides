// Week 5 Day 2 — AgentChat going deeper (TypeScript version of 5_autogen/2_lab2_autogen_agentchat.ipynb)
//   1. a multimodal message: an image plus text
//   2. structured output: the reply is a typed object (zod here, Pydantic in Python)
//   3. tools: web search + file tools confined to sandbox/ (Python borrows them from LangChain with LangChainToolAdapter)
//   4. a team: a primary agent and an evaluator taking turns until "APPROVE" (Python: RoundRobinGroupChat)
//   5. the MCP teaser: the fetch tool from the mcp-server-fetch MCP server
// AutoGen has no JavaScript version; everything below uses the OpenAI Agents SDK for JavaScript.
import { Agent, assistant, MCPServerStdio, run, user, type AgentInputItem } from "@openai/agents";
import { z } from "zod";
import { AssistantAgent } from "./core/assistant.js";
import { MODEL } from "./setup.js";
import { fileTools, searchTool } from "./tools.js";

const step = process.argv[2] ?? "all"; // pnpm lab2 [image|structured|tools|team|mcp]
const wants = (name: string) => step === "all" || step === name;

// ---------- 1. Multimodal ----------
// Python: PIL Image -> AGImage -> MultiModalMessage(content=[text, img], source="User")
// Here: download the bytes, turn them into a base64 data URL, and send an input_image part next to an input_text part.
const url = "https://edwarddonner.com/wp-content/uploads/2024/10/from-software-engineer-to-AI-DS.jpeg";

async function imageMessage(text: string) {
  const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
  const dataUrl = `data:image/jpeg;base64,${bytes.toString("base64")}`;
  return user([
    { type: "input_text", text },
    { type: "input_image", image: dataUrl },
  ]);
}

if (wants("image")) {
  const describer = new Agent({ name: "description_agent", model: MODEL, instructions: "You are good at describing images" });
  const response = await run(describer, [await imageMessage("Describe the content of this image in detail")]);
  console.log(response.finalOutput);
}

// ---------- 2. Structured output ----------
// Python: class ImageDescription(BaseModel) + output_content_type=ImageDescription
const ImageDescription = z.object({
  scene: z.string().describe("Briefly, the overall scene of the image"),
  message: z.string().describe("The point that the image is trying to convey"),
  style: z.string().describe("The artistic style of the image"),
  orientation: z.enum(["portrait", "landscape", "square"]).describe("The orientation of the image"),
});

if (wants("structured")) {
  const describer = new Agent({
    name: "description_agent",
    model: MODEL,
    instructions: "You are good at describing images in detail",
    outputType: ImageDescription, // the SDK sends the JSON schema and parses the JSON reply into an object
  });
  const response = await run(describer, [await imageMessage("Describe the content of this image in detail")]);
  const reply = response.finalOutput!; // typed as { scene, message, style, orientation }
  console.log(`Scene:\n${reply.scene}\n\nMessage:\n${reply.message}\n\nStyle:\n${reply.style}\n\nOrientation:\n${reply.orientation}`);
}

// ---------- 3. Tools: search + files in sandbox/ ----------
if (wants("tools")) {
  const prompt = `Your task is to find a one-way non-stop flight from JFK to LHR in June 2025.
First search online for promising deals.
Next, write all the deals to a file called flights.md with full details.
Finally, select the one you think is best and reply with a short summary.
Reply with the selected flight only, and only after you have written the details to the file.`;

  const tools = [searchTool, ...fileTools];
  for (const t of tools) console.log(t.name, t.description);

  // AssistantAgent (src/core/assistant.ts) remembers the conversation, so the second call can continue the first
  const agent = new AssistantAgent(new Agent({ name: "searcher", model: MODEL, tools }));
  const printInner = (items: { type: string; rawItem?: unknown; output?: unknown }[]) => {
    for (const item of items) {
      if (item.type === "tool_call_item") console.log("[FunctionCall]", JSON.stringify(item.rawItem).slice(0, 200));
      if (item.type === "tool_call_output_item") console.log("[FunctionExecutionResult]", String(item.output).slice(0, 200));
    }
  };
  let result = await agent.onMessages(prompt);
  printInner(result.newItems);
  console.log(result.finalOutput);

  // Python: "Now we need to call the agent again to write the file"
  result = await agent.onMessages("OK proceed");
  printInner(result.newItems);
  console.log(result.finalOutput);
}

// ---------- 4. A team: primary + evaluator, round robin ----------
// Python: RoundRobinGroupChat([primary_agent, evaluation_agent], termination_condition=TextMentionTermination("APPROVE"), max_turns=20)
// The Agents SDK has no team class, so the round robin is a plain loop over a shared transcript.
if (wants("team")) {
  const prompt = "Find a one-way non-stop flight from JFK to LHR in June 2025.";
  const primaryAgent = new Agent({
    name: "primary",
    model: MODEL,
    tools: [searchTool],
    instructions: "You are a helpful AI research assistant who looks for promising deals on flights. Incorporate any feedback you receive.",
  });
  const evaluationAgent = new Agent({
    name: "evaluator",
    model: MODEL,
    instructions: "Provide constructive feedback. Respond with 'APPROVE' when your feedback is addressed.",
  });

  const MAX_TURNS = 20; // "otherwise this can get into a loop.." (the fix for the runaway run in the video)
  const team = [primaryAgent, evaluationAgent];
  const messages: { source: string; content: string }[] = [{ source: "user", content: prompt }];

  // Every agent sees the whole conversation: its own messages as "assistant", everyone else's as "user"
  const viewFor = (name: string): AgentInputItem[] =>
    messages.map((m) => (m.source === name ? assistant(m.content) : user(`${m.source}: ${m.content}`)));

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const speaker = team[turn % team.length]; // round robin: one after the other
    const result = await run(speaker, viewFor(speaker.name));
    const content = String(result.finalOutput ?? "");
    messages.push({ source: speaker.name, content });
    if (content.includes("APPROVE")) break; // TextMentionTermination("APPROVE")
  }
  for (const m of messages) console.log(`${m.source}:\n${m.content}\n\n`);
}

// ---------- 5. MCP teaser ----------
// Python: mcp_server_tools(StdioServerParams(command="uvx", args=["mcp-server-fetch"], read_timeout_seconds=30))
// The SDK launches the same server as a child process and talks MCP to it over stdin/stdout.
// Note: mcp-server-fetch downloads a page over HTTP and converts it to Markdown; it does not drive a browser.
if (wants("mcp")) {
  const fetchMcpServer = new MCPServerStdio({ name: "fetch", command: "uvx", args: ["mcp-server-fetch"], clientSessionTimeoutSeconds: 30 });
  await fetchMcpServer.connect();
  try {
    const agent = new Agent({ name: "fetcher", model: MODEL, mcpServers: [fetchMcpServer] });
    const result = await run(agent, "Review edwarddonner.com and summarize what you learn. Reply in Markdown.");
    console.log(result.finalOutput);
  } finally {
    await fetchMcpServer.close();
  }
}
