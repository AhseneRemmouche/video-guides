// Week 4 Day 4, part 2 — structured outputs and a worker/evaluator graph: the first Sidekick
// (TypeScript version of 4_langgraph/4_lab4.ipynb)
// Python: class EvaluatorOutput(BaseModel) · llm.with_structured_output(EvaluatorOutput) · TypedDict State with 5 fields
// TypeScript: a zod object · llm.withStructuredOutput(EvaluatorOutput) · Annotation.Root with 5 fields
import { Annotation, StateGraph, START, END, MemorySaver, messagesStateReducer } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage, HumanMessage, SystemMessage, type BaseMessage, type BaseMessageLike } from "@langchain/core/messages";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { makeLLM } from "./setup.js";
import { playwrightTools } from "./browserTools.js";

// For structured outputs, we define a schema — a zod object plays the role of the Pydantic model
const EvaluatorOutput = z.object({
  feedback: z.string().describe("Feedback on the assistant's response"),
  success_criteria_met: z.boolean().describe("Whether the success criteria have been met"),
  user_input_needed: z.boolean().describe("True if more input is needed from the user, or clarifications, or the assistant is stuck"),
});

// The state: messages uses the reducer; the other fields have none, so a new value simply overwrites the old one
const State = Annotation.Root({
  messages: Annotation<BaseMessage[], BaseMessageLike[]>({ reducer: messagesStateReducer, default: () => [] }),
  success_criteria: Annotation<string>(),
  feedback_on_work: Annotation<string | null>(),
  success_criteria_met: Annotation<boolean>(),
  user_input_needed: Annotation<boolean>(),
});
type StateT = typeof State.State;

// Get our Playwright tools
const { tools, browser } = await playwrightTools();

// Initialize the LLMs
const worker_llm_with_tools = makeLLM().bindTools(tools);
const evaluator_llm_with_output = makeLLM().withStructuredOutput(EvaluatorOutput); // returns a parsed object, not a message

// The worker node
async function worker(state: StateT) {
  let system_message = `You are a helpful assistant that can use tools to complete tasks.
You keep working on a task until either you have a question or clarification for the user, or the success criteria is met.
This is the success criteria:
${state.success_criteria}
You should reply either with a question for the user about this assignment, or with your final response.
If you have a question for the user, you need to reply by clearly stating your question. An example might be:

Question: please clarify whether you want a summary or a detailed answer

If you've finished, reply with the final answer, and don't ask a question; simply reply with the answer.
`;
  if (state.feedback_on_work) {
    system_message += `
Previously you thought you completed the assignment, but your reply was rejected because the success criteria was not met.
Here is the feedback on why this was rejected:
${state.feedback_on_work}
With this feedback, please continue the assignment, ensuring that you meet the success criteria or have a question for the user.`;
  }

  // Add in the system message: replace an old one if there is one, otherwise put it first
  // (Python edits message.content in place; here we build a new list, which is the safer JavaScript habit)
  const found_system_message = state.messages.some((m) => SystemMessage.isInstance(m));
  const messages = found_system_message
    ? state.messages.map((m) => (SystemMessage.isInstance(m) ? new SystemMessage(system_message) : m))
    : [new SystemMessage(system_message), ...state.messages];

  // Invoke the LLM with tools
  const response = await worker_llm_with_tools.invoke(messages);
  return { messages: [response] };
}

function worker_router(state: StateT): "tools" | "evaluator" {
  const last_message = state.messages.at(-1);
  return AIMessage.isInstance(last_message) && last_message.tool_calls?.length ? "tools" : "evaluator";
}

function format_conversation(messages: BaseMessage[]): string {
  let conversation = "Conversation history:\n\n";
  for (const message of messages) {
    if (HumanMessage.isInstance(message)) conversation += `User: ${message.content}\n`;
    else if (AIMessage.isInstance(message)) conversation += `Assistant: ${message.content || "[Tools use]"}\n`;
  }
  return conversation;
}

async function evaluator(state: StateT): Promise<typeof State.Update> {
  const last_response = state.messages.at(-1)!.content;

  const system_message = `You are an evaluator that determines if a task has been completed successfully by an Assistant.
Assess the Assistant's last response based on the given criteria. Respond with your feedback, and with your decision on whether the success criteria has been met,
and whether more input is needed from the user.`;

  let user_message = `You are evaluating a conversation between the User and Assistant. You decide what action to take based on the last response from the Assistant.

The entire conversation with the assistant, with the user's original request and all replies, is:
${format_conversation(state.messages)}

The success criteria for this assignment is:
${state.success_criteria}

And the final response from the Assistant that you are evaluating is:
${last_response}

Respond with your feedback, and decide if the success criteria is met by this response.
Also, decide if more user input is required, either because the assistant has a question, needs clarification, or seems to be stuck and unable to answer without help.
`;
  if (state.feedback_on_work) {
    user_message += `Also, note that in a prior attempt from the Assistant, you provided this feedback: ${state.feedback_on_work}\n`;
    user_message += "If you're seeing the Assistant repeating the same mistakes, then consider responding that user input is required.";
  }

  const eval_result = await evaluator_llm_with_output.invoke([new SystemMessage(system_message), new HumanMessage(user_message)]);
  return {
    messages: [{ role: "assistant", content: `Evaluator Feedback on this answer: ${eval_result.feedback}` }],
    feedback_on_work: eval_result.feedback,
    success_criteria_met: eval_result.success_criteria_met,
    user_input_needed: eval_result.user_input_needed,
  };
}

function route_based_on_evaluation(state: StateT): "worker" | "END" {
  return state.success_criteria_met || state.user_input_needed ? "END" : "worker";
}

// Set up Graph Builder with State, add nodes, add edges, compile
const memory = new MemorySaver();
const graph = new StateGraph(State)
  .addNode("worker", worker)
  .addNode("tools", new ToolNode(tools))
  .addNode("evaluator", evaluator)
  .addConditionalEdges("worker", worker_router, { tools: "tools", evaluator: "evaluator" })
  .addEdge("tools", "worker")
  .addConditionalEdges("evaluator", route_based_on_evaluation, { worker: "worker", END: END })
  .addEdge(START, "worker")
  .compile({ checkpointer: memory });
console.log(graph.getGraph().drawMermaid());

// Next comes the callback to kick off a super-step (the Gradio process_message)
type ChatMessage = { role: "user" | "assistant"; content: string };
const make_thread_id = () => randomUUID();

async function process_message(message: string, success_criteria: string, history: ChatMessage[], thread: string) {
  const config = { configurable: { thread_id: thread } };
  const state = { messages: [{ role: "user", content: message }], success_criteria, feedback_on_work: null, success_criteria_met: false, user_input_needed: false };
  const result = await graph.invoke(state, config); // stops with GraphRecursionError after 25 steps (LangGraph's default)
  const user: ChatMessage = { role: "user", content: message };
  const reply: ChatMessage = { role: "assistant", content: String(result.messages.at(-2)!.content) }; // the worker's answer
  const feedback: ChatMessage = { role: "assistant", content: String(result.messages.at(-1)!.content) }; // the evaluator's verdict
  return [...history, user, reply, feedback];
}

// "And now launch our Sidekick UI" — the React app comes on Day 5; here we run one request from the console
const message = process.argv[2] ?? "What is the current USD to GBP exchange rate? Use https://www.x-rates.com/calculators/USD/GBP";
const criteria = process.argv[3] ?? "An accurate answer with the rate as a number";
try {
  const history = await process_message(message, criteria, [], make_thread_id());
  for (const m of history) console.log(`\n[${m.role}] ${m.content}`);
} finally {
  await browser.close();
}
