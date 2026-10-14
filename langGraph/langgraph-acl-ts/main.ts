// The LangSmith quickstart from the setup chapter: a weather "search" tool and an agent that uses it.
// createAgent builds the same model -> tools -> model loop that the Python file wires by hand.
import { HumanMessage, createAgent, tool } from "langchain";
import { z } from "zod";
import { getModel } from "./src/model.js";

const search = tool(
  ({ query }) => {
    if (query.toLowerCase().includes("sf") || query.toLowerCase().includes("san francisco")) {
      return "It's 60 degrees and foggy.";
    }
    return "It's 90 degrees and sunny.";
  },
  { name: "search", description: "Call to surf the web.", schema: z.object({ query: z.string() }) },
);

const app = createAgent({ model: getModel(), tools: [search] });

const finalState = await app.invoke(
  { messages: [new HumanMessage("what is the weather in sf")] },
  { configurable: { thread_id: 42 } }, // without a checkpointer the thread_id changes nothing
);

// the Python file ends with the bare expression `final_state["messages"][-1].content`, which prints nothing
console.log(finalState.messages.at(-1)!.text);
