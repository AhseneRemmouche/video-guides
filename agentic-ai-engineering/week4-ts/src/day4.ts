// Week 4 - Day 4: the Sidekick's worker/evaluator loop (LangGraph.js port of 4_lab4.py).
//
// This is the heart of the Sidekick. Two LLM "roles" cooperate in a graph:
//   * worker    - does the task, and may call tools. When it thinks it is done it
//                 produces a plain answer (no tool call).
//   * evaluator - judges that answer against the user's success criteria, using
//                 STRUCTURED OUTPUT (a zod schema -> a typed object), and decides
//                 whether we are done or the worker should try again.
//
// The graph routes:
//   worker --(tool call?)--> tools --> worker
//   worker --(no tool)-----> evaluator --(met OR needs user)--> END
//                                       --(not yet)-----------> worker
//
// The course gives the worker Playwright browser tools; here it gets one safe local
// calculator tool so the file runs with no browser.
import {
  StateGraph,
  Annotation,
  messagesStateReducer,
  START,
  END,
  MemorySaver,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { z } from "zod";
import { makeLlm } from "./model.js";

// --- Structured output for the evaluator (same fields as the course) --------
const EvaluatorOutput = z.object({
  feedback: z.string().describe("Feedback on the assistant's response"),
  success_criteria_met: z.boolean().describe("Whether the success criteria have been met"),
  user_input_needed: z
    .boolean()
    .describe("True if more input is needed from the user, or the assistant is stuck"),
});

// --- Graph state: messages (appended) plus the Sidekick's extra fields ------
const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
  success_criteria: Annotation<string>,
  feedback_on_work: Annotation<string | null>,
  success_criteria_met: Annotation<boolean>,
  user_input_needed: Annotation<boolean>,
});
type State = typeof StateAnnotation.State;

// --- One safe local tool ----------------------------------------------------
const calculator = tool(
  async ({ expression }) => {
    if (!/^[0-9+\-*/(). ]+$/.test(expression)) return "Error: invalid characters.";
    try {
      return String(Function(`"use strict"; return (${expression});`)());
    } catch (err) {
      return `Error: ${String(err)}`;
    }
  },
  {
    name: "calculator",
    description: "Evaluate a basic arithmetic expression, e.g. '120 * 0.15'.",
    schema: z.object({ expression: z.string() }),
  },
);
const tools = [calculator];

const workerLlmWithTools = makeLlm().bindTools(tools);
const evaluatorLlm = makeLlm().withStructuredOutput(EvaluatorOutput);

// The worker node.
async function worker(state: State) {
  let systemMessage = `You are a helpful assistant that can use tools to complete tasks.
You keep working until either you have a question for the user, or the success criteria is met.
This is the success criteria:
${state.success_criteria}
Reply either with a question for the user (start it with "Question:") or with your final answer.`;

  if (state.feedback_on_work) {
    systemMessage += `
Previously your reply was rejected because the success criteria was not met. Feedback:
${state.feedback_on_work}
Continue the assignment, making sure you meet the success criteria or ask the user a question.`;
  }

  // Replace any existing system message, else prepend one.
  const messages = [...state.messages];
  const idx = messages.findIndex((m) => m instanceof SystemMessage);
  if (idx >= 0) messages[idx] = new SystemMessage(systemMessage);
  else messages.unshift(new SystemMessage(systemMessage));

  const response = await workerLlmWithTools.invoke(messages);
  return { messages: [response] };
}

// Router after the worker: tool call -> tools, otherwise -> evaluator.
function workerRouter(state: State): "tools" | "evaluator" {
  const last = state.messages.at(-1) as AIMessage | undefined;
  return last?.tool_calls && last.tool_calls.length > 0 ? "tools" : "evaluator";
}

function formatConversation(messages: BaseMessage[]): string {
  let out = "Conversation history:\n\n";
  for (const m of messages) {
    if (m instanceof HumanMessage) out += `User: ${String(m.content)}\n`;
    else if (m instanceof AIMessage) out += `Assistant: ${String(m.content) || "[Tool use]"}\n`;
  }
  return out;
}

// The evaluator node: judges the worker's last answer (structured output).
async function evaluator(state: State) {
  const lastResponse = String(state.messages.at(-1)?.content ?? "");
  const systemMessage =
    "You are an evaluator that decides if a task was completed successfully by an Assistant. " +
    "Assess the last response against the criteria, give feedback, and decide whether the " +
    "success criteria are met and whether more user input is needed.";
  let userMessage = `You are evaluating a conversation between the User and Assistant.

${formatConversation(state.messages)}

The success criteria is:
${state.success_criteria}

The Assistant's final response you are evaluating is:
${lastResponse}

Decide if the success criteria are met, and if more user input is required (a question, a clarification, or the assistant is stuck).`;
  if (state.feedback_on_work) {
    userMessage += `\nPrior feedback you gave: ${state.feedback_on_work}\nIf the Assistant repeats mistakes, consider requiring user input.`;
  }

  const result = await evaluatorLlm.invoke([
    new SystemMessage(systemMessage),
    new HumanMessage(userMessage),
  ]);
  return {
    messages: [new AIMessage(`Evaluator Feedback: ${result.feedback}`)],
    feedback_on_work: result.feedback,
    success_criteria_met: result.success_criteria_met,
    user_input_needed: result.user_input_needed,
  };
}

// Router after the evaluator: done -> END, otherwise loop back to worker.
function routeBasedOnEvaluation(state: State): "worker" | typeof END {
  return state.success_criteria_met || state.user_input_needed ? END : "worker";
}

const graph = new StateGraph(StateAnnotation)
  .addNode("worker", worker)
  .addNode("tools", new ToolNode(tools))
  .addNode("evaluator", evaluator)
  .addEdge(START, "worker")
  .addConditionalEdges("worker", workerRouter, { tools: "tools", evaluator: "evaluator" })
  .addEdge("tools", "worker")
  .addConditionalEdges("evaluator", routeBasedOnEvaluation, { worker: "worker", [END]: END })
  .compile({ checkpointer: new MemorySaver() });

async function main() {
  console.log(await graph.getGraphAsync().then((g) => g.drawMermaid()));

  const result = await graph.invoke(
    {
      messages: [
        new HumanMessage(
          "Use the calculator to work out a 15% tip on a $120 bill, then state the tip amount.",
        ),
      ],
      success_criteria: "The reply states the tip amount in dollars for a 15% tip on $120.",
      feedback_on_work: null,
      success_criteria_met: false,
      user_input_needed: false,
    },
    { configurable: { thread_id: "day4-demo" } },
  );

  console.log("Worker answer :", result.messages.at(-2)?.content);
  console.log("Evaluator      :", result.messages.at(-1)?.content);
  console.log("Criteria met   :", result.success_criteria_met);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
