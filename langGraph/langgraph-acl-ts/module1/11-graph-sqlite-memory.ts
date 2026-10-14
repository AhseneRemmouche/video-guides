import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { HumanMessage } from "langchain";
import { createInterface } from "node:readline";
import { isMain } from "../src/is-main.js";
// reuse the agent we already built in 8-graph-agent.ts (it exports its builder)
import { builder } from "./8-graph-agent.js";

// a real file on disk: the conversation survives when the program stops
const memory = SqliteSaver.fromConnString("checkpoints.sqlite");
export const graph = builder.compile({ checkpointer: memory });

if (isMain(import.meta.url)) {
  const threadId = process.argv[2] ?? "student-1";
  const config = { configurable: { thread_id: threadId } };

  console.log(`Thread '${threadId}'. Type a question, or q to quit.`);
  const terminal = createInterface({ input: process.stdin, output: process.stdout, prompt: "You: " });
  // when the input ends (Ctrl+Z / Ctrl+D, or the end of a piped file) readline closes, and prompt() would throw
  let closed = false;
  terminal.on("close", () => (closed = true));
  terminal.prompt();
  for await (const line of terminal) { // one line each time you press Enter
    const question = line.trim();
    if (["q", "quit", "exit"].includes(question.toLowerCase())) break;
    if (question) {
      const result = await graph.invoke({ messages: [new HumanMessage(question)] }, config);
      console.log("Teacher:", result.messages.at(-1)!.text);
    }
    if (!closed) terminal.prompt();
  }
  terminal.close();

  const saved = (await graph.getState(config)).values.messages ?? [];
  console.log(`${saved.length} messages saved for thread '${threadId}' in checkpoints.sqlite`);
}
