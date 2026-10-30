// Week 4 - the Sidekick graph builder (LangGraph.js port of sidekick.py).
//
// Same worker/evaluator graph as day 4, packaged as a class so each user session gets
// its own graph, its own tools, and its own thread id (its own memory). The worker uses
// the full tool set from sidekick-tools.ts; the evaluator uses structured output.
//
//   START -> worker -> (tool call?) -> tools -> worker
//                    -> (no tool)   -> evaluator -> (done | needs user) -> END
//                                                -> (not yet)            -> worker
import {
  StateGraph,
  Annotation,
  messagesStateReducer,
  START,
  END,
  MemorySaver,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { makeLlm } from "./model.js";
import { sidekickTools } from "./sidekick-tools.js";

// Structured output the evaluator must produce (same fields as the course).
const EvaluatorOutput = z.object({
  feedback: z.string().describe("Feedback on the assistant's response"),
  success_criteria_met: z.boolean().describe("Whether the success criteria have been met"),
  user_input_needed: z
    .boolean()
    .describe("True if more input is needed from the user, or the assistant is stuck"),
});

// The graph state: the conversation plus the Sidekick's bookkeeping fields.
const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
  success_criteria: Annotation<string>,
  feedback_on_work: Annotation<string | null>,
  success_criteria_met: Annotation<boolean>,
  user_input_needed: Annotation<boolean>,
});
type State = typeof StateAnnotation.State;

/** The result of one "superstep": the worker's answer and the evaluator's verdict. */
export interface SidekickResult {
  answer: string;
  feedback: string;
  success_criteria_met: boolean;
  user_input_needed: boolean;
}

export class Sidekick {
  readonly id = randomUUID(); // doubles as the conversation thread id
  private tools: StructuredToolInterface[] = [];
  private graph!: ReturnType<Sidekick["buildGraph"]>;
  private readonly memory = new MemorySaver();

  /** Build the tools and compile the graph. Call once before run(). */
  async setup(): Promise<void> {
    this.tools = await sidekickTools();
    this.graph = this.buildGraph();
  }

  private worker = async (state: State) => {
    const llm = makeLlm().bindTools(this.tools);
    let systemMessage = `You are a helpful assistant that can use tools to complete tasks.
You keep working until either you have a question for the user, or the success criteria is met.
You have tools: a calculator, web search, file read/write/list, a JavaScript runner and a push notification.
The current date and time is ${new Date().toISOString()}

This is the success criteria:
${state.success_criteria}
Reply either with a question for the user (start it with "Question:") or with your final answer.`;

    if (state.feedback_on_work) {
      systemMessage += `
Previously your reply was rejected because the success criteria was not met. Feedback:
${state.feedback_on_work}
Continue, making sure you meet the success criteria or ask the user a question.`;
    }

    const messages = [...state.messages];
    const idx = messages.findIndex((m) => m instanceof SystemMessage);
    if (idx >= 0) messages[idx] = new SystemMessage(systemMessage);
    else messages.unshift(new SystemMessage(systemMessage));

    return { messages: [await llm.invoke(messages)] };
  };

  private workerRouter = (state: State): "tools" | "evaluator" => {
    const last = state.messages.at(-1) as AIMessage | undefined;
    return last?.tool_calls && last.tool_calls.length > 0 ? "tools" : "evaluator";
  };

  private formatConversation(messages: BaseMessage[]): string {
    let out = "Conversation history:\n\n";
    for (const m of messages) {
      if (m instanceof HumanMessage) out += `User: ${String(m.content)}\n`;
      else if (m instanceof AIMessage) out += `Assistant: ${String(m.content) || "[Tool use]"}\n`;
    }
    return out;
  }

  private evaluator = async (state: State) => {
    const lastResponse = String(state.messages.at(-1)?.content ?? "");
    const systemMessage =
      "You are an evaluator that decides if a task was completed successfully by an Assistant. " +
      "Assess the last response against the criteria, give feedback, and decide whether the " +
      "success criteria are met and whether more user input is needed.";
    let userMessage = `You are evaluating a conversation between the User and Assistant.

${this.formatConversation(state.messages)}

The success criteria is:
${state.success_criteria}

The Assistant's final response you are evaluating is:
${lastResponse}

Decide if the success criteria are met, and if more user input is required.
If the Assistant says it wrote a file, you may assume it did.`;
    if (state.feedback_on_work) {
      userMessage += `\nPrior feedback you gave: ${state.feedback_on_work}\nIf the Assistant repeats mistakes, consider requiring user input.`;
    }

    const llm = makeLlm().withStructuredOutput(EvaluatorOutput);
    const result = await llm.invoke([
      new SystemMessage(systemMessage),
      new HumanMessage(userMessage),
    ]);
    return {
      messages: [new AIMessage(`Evaluator Feedback: ${result.feedback}`)],
      feedback_on_work: result.feedback,
      success_criteria_met: result.success_criteria_met,
      user_input_needed: result.user_input_needed,
    };
  };

  private routeBasedOnEvaluation = (state: State): "worker" | typeof END =>
    state.success_criteria_met || state.user_input_needed ? END : "worker";

  private buildGraph() {
    return new StateGraph(StateAnnotation)
      .addNode("worker", this.worker)
      .addNode("tools", new ToolNode(this.tools))
      .addNode("evaluator", this.evaluator)
      .addEdge(START, "worker")
      .addConditionalEdges("worker", this.workerRouter, { tools: "tools", evaluator: "evaluator" })
      .addEdge("tools", "worker")
      .addConditionalEdges("evaluator", this.routeBasedOnEvaluation, {
        worker: "worker",
        [END]: END,
      })
      .compile({ checkpointer: this.memory });
  }

  /** Run one request through the graph. Reuses this session's thread id for memory. */
  async run(message: string, successCriteria: string): Promise<SidekickResult> {
    const result = await this.graph.invoke(
      {
        messages: [new HumanMessage(message)],
        success_criteria: successCriteria || "The answer should be clear and accurate",
        feedback_on_work: null,
        success_criteria_met: false,
        user_input_needed: false,
      },
      { configurable: { thread_id: this.id } },
    );
    return {
      answer: String(result.messages.at(-2)?.content ?? ""),
      feedback: String(result.messages.at(-1)?.content ?? ""),
      success_criteria_met: Boolean(result.success_criteria_met),
      user_input_needed: Boolean(result.user_input_needed),
    };
  }

  /** The graph's structure as Mermaid text (handy for the UI / docs). */
  async mermaid(): Promise<string> {
    const g = await this.graph.getGraphAsync();
    return g.drawMermaid();
  }
}
