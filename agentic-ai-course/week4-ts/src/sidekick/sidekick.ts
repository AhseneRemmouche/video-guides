// Week 4 Day 5 — the Sidekick as a class (TypeScript version of 4_langgraph/sidekick.py)
// The graph is lab4's worker → tools → evaluator loop, now with all the tools and three prompt fixes from the video:
// the current date, the print() hint for the Python tool, and "give the Assistant the benefit of the doubt".
// Python method → TypeScript method: setup → setup, worker → worker, worker_router → workerRouter,
// format_conversation → formatConversation, evaluator → evaluator, route_based_on_evaluation → routeBasedOnEvaluation,
// build_graph → buildGraph, run_superstep → runSuperstep, cleanup → cleanup.
import { Annotation, StateGraph, START, END, MemorySaver, messagesStateReducer } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage, HumanMessage, SystemMessage, type BaseMessage, type BaseMessageLike } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import type { Browser } from "playwright";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { makeLLM } from "../setup.js";
import { playwright_tools, other_tools } from "./sidekick_tools.js";

export const State = Annotation.Root({
  messages: Annotation<BaseMessage[], BaseMessageLike[]>({ reducer: messagesStateReducer, default: () => [] }),
  success_criteria: Annotation<string>(),
  feedback_on_work: Annotation<string | null>(),
  success_criteria_met: Annotation<boolean>(),
  user_input_needed: Annotation<boolean>(),
});
type StateT = typeof State.State;

export const EvaluatorOutput = z.object({
  feedback: z.string().describe("Feedback on the assistant's response"),
  success_criteria_met: z.boolean().describe("Whether the success criteria have been met"),
  user_input_needed: z.boolean().describe("True if more input is needed from the user, or clarifications, or the assistant is stuck"),
});

export type ChatMessage = { role: "user" | "assistant"; content: string };

function buildWorkerLLM(tools: StructuredToolInterface[]) {
  return makeLLM().bindTools(tools);
}
function buildEvaluatorLLM() {
  return makeLLM().withStructuredOutput(EvaluatorOutput);
}

export class Sidekick {
  private worker_llm_with_tools?: ReturnType<typeof buildWorkerLLM>;
  private evaluator_llm_with_output?: ReturnType<typeof buildEvaluatorLLM>;
  private tools: StructuredToolInterface[] = [];
  private graph?: Awaited<ReturnType<Sidekick["buildGraph"]>>;
  readonly sidekick_id = randomUUID(); // also the checkpointer's thread_id: one conversation per Sidekick
  private memory = new MemorySaver();
  private browser?: Browser;

  async setup() {
    const { tools, browser } = await playwright_tools();
    this.tools = [...tools, ...(await other_tools())];
    this.browser = browser;
    this.worker_llm_with_tools = buildWorkerLLM(this.tools);
    this.evaluator_llm_with_output = buildEvaluatorLLM();
    this.graph = await this.buildGraph();
  }

  // Arrow-function properties keep `this` bound when LangGraph calls them as nodes (Python's self.worker does this for free)
  worker = async (state: StateT) => {
    // the date is local time as "YYYY-MM-DD HH:MM:SS" (the sv-SE locale happens to use exactly Python's strftime format)
    let system_message = `You are a helpful assistant that can use tools to complete tasks.
    You keep working on a task until either you have a question or clarification for the user, or the success criteria is met.
    You have many tools to help you, including tools to browse the internet, navigating and retrieving web pages.
    You have a tool to run python code, but note that you would need to include a print() statement if you wanted to receive output.
    The current date and time is ${new Date().toLocaleString("sv-SE")}

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

    // Add in the system message
    const found_system_message = state.messages.some((m) => SystemMessage.isInstance(m));
    const messages = found_system_message
      ? state.messages.map((m) => (SystemMessage.isInstance(m) ? new SystemMessage(system_message) : m))
      : [new SystemMessage(system_message), ...state.messages];

    // Invoke the LLM with tools
    const response = await this.worker_llm_with_tools!.invoke(messages);

    // Return updated state
    return { messages: [response] };
  };

  workerRouter = (state: StateT): "tools" | "evaluator" => {
    const last_message = state.messages.at(-1);
    return AIMessage.isInstance(last_message) && last_message.tool_calls?.length ? "tools" : "evaluator";
  };

  formatConversation(messages: BaseMessage[]): string {
    let conversation = "Conversation history:\n\n";
    for (const message of messages) {
      if (HumanMessage.isInstance(message)) conversation += `User: ${message.content}\n`;
      else if (AIMessage.isInstance(message)) conversation += `Assistant: ${message.content || "[Tools use]"}\n`;
    }
    return conversation;
  }

  evaluator = async (state: StateT): Promise<typeof State.Update> => {
    const last_response = state.messages.at(-1)!.content;

    const system_message = `You are an evaluator that determines if a task has been completed successfully by an Assistant.
    Assess the Assistant's last response based on the given criteria. Respond with your feedback, and with your decision on whether the success criteria has been met,
    and whether more input is needed from the user.`;

    let user_message = `You are evaluating a conversation between the User and Assistant. You decide what action to take based on the last response from the Assistant.

    The entire conversation with the assistant, with the user's original request and all replies, is:
    ${this.formatConversation(state.messages)}

    The success criteria for this assignment is:
    ${state.success_criteria}

    And the final response from the Assistant that you are evaluating is:
    ${last_response}

    Respond with your feedback, and decide if the success criteria is met by this response.
    Also, decide if more user input is required, either because the assistant has a question, needs clarification, or seems to be stuck and unable to answer without help.

    The Assistant has access to a tool to write files. If the Assistant says they have written a file, then you can assume they have done so.
    Overall you should give the Assistant the benefit of the doubt if they say they've done something. But you should reject if you feel that more work should go into this.

    `;
    if (state.feedback_on_work) {
      user_message += `Also, note that in a prior attempt from the Assistant, you provided this feedback: ${state.feedback_on_work}\n`;
      user_message += "If you're seeing the Assistant repeating the same mistakes, then consider responding that user input is required.";
    }

    const eval_result = await this.evaluator_llm_with_output!.invoke([new SystemMessage(system_message), new HumanMessage(user_message)]);
    return {
      messages: [{ role: "assistant", content: `Evaluator Feedback on this answer: ${eval_result.feedback}` }],
      feedback_on_work: eval_result.feedback,
      success_criteria_met: eval_result.success_criteria_met,
      user_input_needed: eval_result.user_input_needed,
    };
  };

  routeBasedOnEvaluation = (state: StateT): "worker" | "END" =>
    state.success_criteria_met || state.user_input_needed ? "END" : "worker";

  async buildGraph() {
    // Set up Graph Builder with State, add nodes, add edges, compile
    return new StateGraph(State)
      .addNode("worker", this.worker)
      .addNode("tools", new ToolNode(this.tools))
      .addNode("evaluator", this.evaluator)
      .addConditionalEdges("worker", this.workerRouter, { tools: "tools", evaluator: "evaluator" })
      .addEdge("tools", "worker")
      .addConditionalEdges("evaluator", this.routeBasedOnEvaluation, { worker: "worker", END: END })
      .addEdge(START, "worker")
      .compile({ checkpointer: this.memory });
  }

  /** One super-step: the user's message goes in, the worker/evaluator loop runs, the chat history comes back
   *  with three more entries: the user's message, the worker's reply and the evaluator's feedback. */
  async runSuperstep(message: string, success_criteria: string, history: ChatMessage[]): Promise<ChatMessage[]> {
    const config = { configurable: { thread_id: this.sidekick_id } };

    const state = {
      messages: [{ role: "user", content: message }],
      success_criteria: success_criteria || "The answer should be clear and accurate",
      feedback_on_work: null,
      success_criteria_met: false,
      user_input_needed: false,
    };
    const result = await this.graph!.invoke(state, config);
    const user: ChatMessage = { role: "user", content: message };
    const reply: ChatMessage = { role: "assistant", content: String(result.messages.at(-2)!.content) };
    const feedback: ChatMessage = { role: "assistant", content: String(result.messages.at(-1)!.content) };
    return [...history, user, reply, feedback];
  }

  /** Close Chromium. Python needs event-loop juggling here; in Node an await is enough. */
  async cleanup() {
    await this.browser?.close().catch(() => {});
  }
}
