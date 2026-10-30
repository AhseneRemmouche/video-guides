// ResearchManager (TypeScript port of 2_openai/deep_research/research_manager.py).
// It orchestrates the four agents: plan -> search (in parallel) -> write -> email.
//
// The Python version is an async generator that yields status strings. Here run() is an async generator too,
// so a console runner or the HTTP API can watch progress; the final value yielded is the markdown report.
import { run, withTrace, getGlobalTraceProvider } from "@openai/agents";
import { plannerAgent, type WebSearchItem, type WebSearchPlan } from "./planner.js";
import { searchAgent } from "./search.js";
import { writerAgent, type ReportData } from "./writer.js";
import { emailAgent } from "./email.js";
import { LOCAL } from "../setup.js";

export class ResearchManager {
  /** The full report from the most recent run (set once writeReport completes). */
  report: ReportData | undefined;

  /** Run the deep research process, yielding status updates and finally the markdown report. */
  async *run(query: string): AsyncGenerator<string> {
    const traceId = getGlobalTraceProvider().generateTraceId();
    const updates: string[] = [];
    this.report = undefined;
    // A local captured by the closure below. Because it is assigned inside a closure, TypeScript keeps it at
    // its declared type at the use site (unlike a class property, which it would narrow to never here).
    let report: ReportData | undefined;

    const work = withTrace(
      "Research trace",
      async () => {
        if (!LOCAL) updates.push(`View trace: https://platform.openai.com/traces/trace?trace_id=${traceId}`);
        console.log("Starting research...");
        const plan = await this.planSearches(query);
        updates.push("Searches planned, starting to search...");
        const results = await this.performSearches(plan);
        updates.push("Searches complete, writing report...");
        report = await this.writeReport(query, results);
        this.report = report;
        updates.push("Report written, sending email...");
        await this.sendEmail(report);
        updates.push("Email sent, research complete");
      },
      { traceId },
    );

    // Drain status updates as they are recorded, while the workflow runs.
    let done = false;
    void work.finally(() => {
      done = true;
    });
    let sent = 0;
    while (!done || sent < updates.length) {
      if (sent < updates.length) {
        yield updates[sent++]!;
      } else {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    await work; // rethrow if the workflow failed
    if (report) yield report.markdown_report;
  }

  /** Plan the searches to perform for the query. */
  async planSearches(query: string): Promise<WebSearchPlan> {
    console.log("Planning searches...");
    const result = await run(plannerAgent, `Query: ${query}`);
    const plan = result.finalOutput!;
    console.log(`Will perform ${plan.searches.length} searches`);
    return plan;
  }

  /** Perform the planned searches in parallel; report progress as each one completes. */
  async performSearches(plan: WebSearchPlan): Promise<string[]> {
    console.log("Searching...");
    let numCompleted = 0;
    const tasks = plan.searches.map((item) =>
      this.search(item).then((r) => {
        numCompleted += 1;
        console.log(`Searching... ${numCompleted}/${plan.searches.length} completed`);
        return r;
      }),
    );
    const results = (await Promise.all(tasks)).filter((r): r is string => r !== null);
    console.log("Finished searching");
    return results;
  }

  /** Perform one search; a failed search returns null instead of killing the whole run. */
  async search(item: WebSearchItem): Promise<string | null> {
    const input = `Search term: ${item.query}\nReason for searching: ${item.reason}`;
    try {
      const result = await run(searchAgent, input);
      return String(result.finalOutput);
    } catch {
      return null;
    }
  }

  async writeReport(query: string, searchResults: string[]): Promise<ReportData> {
    console.log("Thinking about report...");
    const input = `Original query: ${query}\nSummarized search results: ${JSON.stringify(searchResults)}`;
    const result = await run(writerAgent, input);
    console.log("Finished writing report");
    return result.finalOutput!;
  }

  async sendEmail(report: ReportData): Promise<ReportData> {
    console.log("Writing email...");
    await run(emailAgent, report.markdown_report);
    console.log("Email sent");
    return report;
  }
}
