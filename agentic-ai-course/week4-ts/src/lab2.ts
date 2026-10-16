// Week 4 Day 3 — tools, conditional edges and memory through checkpointing (TypeScript version of 4_langgraph/2_lab2.ipynb)
// Python: llm.bind_tools(tools) · ToolNode(tools=tools) · tools_condition · compile(checkpointer=MemorySaver()) · SqliteSaver
// TypeScript: llm.bindTools(tools) · new ToolNode(tools) · toolsCondition · compile({ checkpointer: new MemorySaver() }) · SqliteSaver
import { StateGraph, START, END, MemorySaver, MessagesAnnotation, type BaseCheckpointSaver } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { makeLLM } from "./setup.js";
import { toolSearch, toolPush } from "./tools.js";

// The LangChain tool interface: every tool can be called with .invoke(input)
console.log(await toolSearch.invoke("What is the capital of France?"));
console.log(await toolPush.invoke("Hello, me"));

// Bring them together
const tools = [toolSearch, toolPush];

// Step 1: Define the State object. MessagesAnnotation is the ready-made { messages: [...] with the add-messages reducer },
// the same State we wrote by hand in lab1 (Python switches from BaseModel to TypedDict here; TS has only one way).
const State = MessagesAnnotation;

// This is different: bind_tools sends the tools' JSON schemas to the model with every call
const llm = makeLLM();
const llm_with_tools = llm.bindTools(tools);

// Step 3: Create a Node
async function chatbot(state: typeof State.State) {
  return { messages: [await llm_with_tools.invoke(state.messages)] };
}

// Steps 2–5 in one function, because we build the same graph three times with a different checkpointer
function buildGraph(checkpointer?: BaseCheckpointSaver) {
  return new StateGraph(State)
    .addNode("chatbot", chatbot)
    .addNode("tools", new ToolNode(tools)) // runs whichever tools the last AI message asked for
    // toolsCondition looks at the last message: tool calls → "tools", otherwise → END
    .addConditionalEdges("chatbot", toolsCondition, ["tools", END])
    // Any time a tool is called, we return to the chatbot to decide the next step
    .addEdge("tools", "chatbot")
    .addEdge(START, "chatbot")
    .compile({ checkpointer });
}

let graph = buildGraph();
console.log(graph.getGraph().drawMermaid());

// That's it! And, let's do this: (the Gradio ChatInterface becomes a function we call)
async function chat(user_input: string, config?: { configurable: { thread_id: string } }) {
  const result = await graph.invoke({ messages: [{ role: "user", content: user_input }] }, config);
  return result.messages.at(-1)!.content;
}
console.log("\n--- tools, no memory");
console.log(await chat("Please search for the capital of France, then send me a push notification with the answer"));
console.log(await chat("My name is Ed"));
console.log(await chat("What's my name?"), "  <- no memory between invokes (super-steps)");

// OK it's time to add Memory! The reducer combines updates *within* one invoke; a checkpointer saves the state
// after every step, keyed by thread_id, so the next invoke on the same thread starts where the last one ended.
console.log("\n--- MemorySaver, thread 1");
const memory = new MemorySaver();
graph = buildGraph(memory);
const config = { configurable: { thread_id: "1" } };
console.log(await chat("hi there, my name is Ed", config));
console.log(await chat("What's my name?", config), "  <- remembered through the checkpoint");
console.log("thread 2:", await chat("What's my name?", { configurable: { thread_id: "2" } }), "  <- a new thread starts empty");

const snapshot = await graph.getState(config); // Python: graph.get_state(config)
console.log(`get_state: ${snapshot.values.messages.length} messages, next=${JSON.stringify(snapshot.next)}`);
const history = []; // Python: list(graph.get_state_history(config)) — most recent first
for await (const s of graph.getStateHistory(config)) history.push(s);
console.log(`get_state_history: ${history.length} checkpoints, latest id ${history[0].config.configurable?.checkpoint_id}`);
// Time travel: graph.invoke(null, { configurable: { thread_id: "1", checkpoint_id: "..." } }) re-runs from that checkpoint.

// And now let's store in SQL — the state survives a restart of the program
console.log("\n--- SqliteSaver, thread 3 (memory.db)");
const sql_memory = SqliteSaver.fromConnString("memory.db"); // Python: SqliteSaver(sqlite3.connect("memory.db"))
graph = buildGraph(sql_memory);
const sqlConfig = { configurable: { thread_id: "3" } };
console.log(await chat("hi there, my name is Ed", sqlConfig));
// a brand-new saver on the same file, as if the program had been restarted
graph = buildGraph(SqliteSaver.fromConnString("memory.db"));
console.log(await chat("What's my name?", sqlConfig), "  <- read back from memory.db");
