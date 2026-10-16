// Week 4 Day 2 — your first LangGraph graphs (TypeScript version of 4_langgraph/1_lab1.ipynb)
// Python: class State(BaseModel): messages: Annotated[list, add_messages] · StateGraph(State) · add_node · add_edge · compile()
// TypeScript: Annotation.Root({ messages: Annotation({ reducer: messagesStateReducer }) }) · the same builder calls
import { Annotation, StateGraph, START, END, messagesStateReducer } from "@langchain/langgraph";
import { AIMessage, HumanMessage, type BaseMessage, type BaseMessageLike } from "@langchain/core/messages";
import { makeLLM } from "./setup.js";

// Some useful constants
const nouns = ["Cabbages", "Unicorns", "Toasters", "Penguins", "Bananas", "Zombies", "Rainbows", "Eels", "Pickles", "Muffins"];
const adjectives = ["outrageous", "smelly", "pedantic", "existential", "moody", "sparkly", "untrustworthy", "sarcastic", "squishy", "haunted"];
const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)]; // Python: random.choice

// Python uses Annotated[str, "something to be shouted"] to attach extra information to a type.
// TypeScript has no Annotated; a doc comment plays that role for people, and Annotation(...) plays it for LangGraph.
/** @param text something to be shouted */
function shout(text: string): string {
  console.log(text.toUpperCase());
  return text.toUpperCase();
}
shout("hello");

// The reducer idea: a reducer is the function LangGraph calls to combine the old value of a field with a node's new value.
// messagesStateReducer (also exported as addMessages, Python's add_messages) appends messages instead of replacing them.
const combined = messagesStateReducer([new HumanMessage("hi")], [new AIMessage("hello there")]);
console.log("reducer result:", combined.map((m) => `${m.getType()}: ${m.content}`));

// Step 1: Define the State object
const State = Annotation.Root({
  // <stored type, type a node may return>; reducer = how updates are merged; default = the starting value
  messages: Annotation<BaseMessage[], BaseMessageLike[]>({ reducer: messagesStateReducer, default: () => [] }),
});

// Step 2: Start the Graph Builder with this State class
// Step 3: Create a Node — any function that takes the old state and returns an update
function our_first_node(old_state: typeof State.State): typeof State.Update {
  const reply = `${pick(nouns)} are ${pick(adjectives)}`;
  const messages = [{ role: "assistant", content: reply }];
  return { messages }; // the reducer appends this to old_state.messages
}

// Step 4: Create Edges   Step 5: Compile the Graph   (the JS builder is chained, so steps 2–5 read as one expression)
const graph = new StateGraph(State)
  .addNode("first_node", our_first_node)
  .addEdge(START, "first_node")
  .addEdge("first_node", END)
  .compile();

// Python: display(Image(graph.get_graph().draw_mermaid_png())) — here we print the Mermaid text (paste it into mermaid.live)
console.log(graph.getGraph().drawMermaid());

// That's it! Showtime! — the Gradio ChatInterface becomes a plain function we call with a few messages
async function chat(user_input: string) {
  const result = await graph.invoke({ messages: [{ role: "user", content: user_input }] });
  console.log(result.messages.map((m) => `${m.getType()}: ${m.content}`));
  return result.messages.at(-1)!.content;
}
console.log("user: hi there →", await chat("hi there"));
console.log("user: you don't say →", await chat("you don't say"));

// Now the 5 steps again, but with an LLM in the node
const llm = makeLLM();

async function chatbot_node(old_state: typeof State.State): Promise<typeof State.Update> {
  const response = await llm.invoke(old_state.messages);
  return { messages: [response] };
}

// TypeScript gives each compiled graph its own type (it knows the node names), so the new graph gets a new name
const chatbotGraph = new StateGraph(State)
  .addNode("chatbot", chatbot_node)
  .addEdge(START, "chatbot")
  .addEdge("chatbot", END)
  .compile();
console.log(chatbotGraph.getGraph().drawMermaid());

// That's it! And, let's do this:
async function chatWithLLM(user_input: string) {
  const result = await chatbotGraph.invoke({ messages: [{ role: "user", content: user_input }] });
  return result.messages.at(-1)!.content;
}
console.log("user: hi there, my name is Ed →", await chatWithLLM("hi there, my name is Ed"));
// each invoke starts from an empty state, so the graph has no memory yet (that is Day 3's checkpointing)
console.log("user: what's my name? →", await chatWithLLM("what's my name?"));
