// Week 4 Day 4, part 1 — give the agent a browser (TypeScript version of 4_langgraph/3_lab3.ipynb)
// Python: PlayWrightBrowserToolkit.from_browser(async_browser).get_tools() · await tool.arun(...) · await graph.ainvoke(...)
// TypeScript: browserTools(browser) from ./browserTools.ts · await tool.invoke(...) · await graph.invoke(...)
// JavaScript is async all the way down, so there is no sync/async pair of methods and no nest_asyncio.
import { StateGraph, START, END, MemorySaver, MessagesAnnotation } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { makeLLM } from "./setup.js";
import { toolPush } from "./tools.js";
import { playwrightTools } from "./browserTools.js";

const State = MessagesAnnotation;

// The browser tools (headful like the course: a Chromium window opens; HEADLESS=true hides it)
const { tools, browser } = await playwrightTools();
for (const tool of tools) console.log(`${tool.name}=${tool.description}`);

// Python builds tool_dict with a dict comprehension; Object.fromEntries is the JavaScript idiom
const tool_dict = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
const navigate_tool = tool_dict["navigate_browser"];
const extract_text_tool = tool_dict["extract_text"];

console.log(await navigate_tool.invoke({ url: process.env.LAB3_URL ?? "https://www.cnn.com" }));
const text = (await extract_text_tool.invoke({})) as string;
console.log(text.slice(0, 600), "…"); // Python: print(textwrap.fill(text))

const all_tools = [...tools, toolPush];

const llm = makeLLM();
const llm_with_tools = llm.bindTools(all_tools);

async function chatbot(state: typeof State.State) {
  return { messages: [await llm_with_tools.invoke(state.messages)] };
}

const memory = new MemorySaver();
const graph = new StateGraph(State)
  .addNode("chatbot", chatbot)
  .addNode("tools", new ToolNode(all_tools))
  .addConditionalEdges("chatbot", toolsCondition, ["tools", END])
  .addEdge("tools", "chatbot")
  .addEdge(START, "chatbot")
  .compile({ checkpointer: memory });
console.log(graph.getGraph().drawMermaid());

const config = { configurable: { thread_id: "10" } };

async function chat(user_input: string) {
  const result = await graph.invoke({ messages: [{ role: "user", content: user_input }] }, config);
  return result.messages.at(-1)!.content;
}

// The two requests from the video: a headline as a push notification, then an exchange rate from a web page
const requests = process.argv.length > 2 ? process.argv.slice(2) : [
  "Please navigate to https://www.cnn.com, read the page and send me a push notification with the top headline",
  "Please navigate to https://www.x-rates.com/calculators/USD/GBP and tell me the current USD to GBP exchange rate",
];
try {
  for (const r of requests) console.log(`\nuser: ${r}\nassistant: ${await chat(r)}`);
} finally {
  await browser.close(); // the notebook never closes it; a script must, or Node keeps running
}
