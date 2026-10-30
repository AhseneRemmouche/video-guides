// The writer agent (TypeScript port of 2_openai/deep_research/writer_agent.py).
// Structured output: a short summary, the full markdown report, and follow-up questions.
import { Agent } from "@openai/agents";
import { z } from "zod";
import { MODEL } from "../setup.js";

export const ReportData = z.object({
  short_summary: z.string().describe("A short 2-3 sentence summary of the findings."),
  markdown_report: z.string().describe("The final report"),
  follow_up_questions: z.array(z.string()).describe("Suggested topics to research further"),
});
export type ReportData = z.infer<typeof ReportData>;

export const writerAgent = new Agent({
  name: "WriterAgent",
  instructions:
    "You are a senior researcher tasked with writing a cohesive report for a research query. You will be " +
    "provided with the original query, and some initial research done by a research assistant.\n" +
    "You should first come up with an outline for the report that describes the structure and flow of the " +
    "report. Then, generate the report and return that as your final output.\n" +
    "The final output should be in markdown format, and it should be lengthy and detailed. Aim for 5-10 pages " +
    "of content, at least 1000 words.",
  model: MODEL,
  outputType: ReportData,
});
