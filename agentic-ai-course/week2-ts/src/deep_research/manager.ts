// ResearchManager (TypeScript version of 2_openai/deep_research/research_manager.py)
// An async generator: Python "yield" status strings become "yield" in an async function*; the UI consumes them.
import { run, withTrace, getGlobalTraceProvider } from "@openai/agents";
import { emailAgent, plannerAgent, searchAgent, writerAgent, type ReportData, type WebSearchItem, type WebSearchPlan } from "./agents.js";
import { LOCAL } from "../setup.js";

export class ResearchManager {
  /** Run the deep research process, yielding status updates and the final report */
  async *run(query: string): AsyncGenerator<string> {
    const traceId = getGlobalTraceProvider().generateTraceId();
    const updates: string[] = [];
    let report: ReportData | undefined;
    // withTrace wraps the whole workflow in one trace; the generator yields what the workflow records
    const work = withTrace("Research trace", async () => {
      if (!LOCAL) updates.push(`View trace: https://platform.openai.com/traces/trace?trace_id=${traceId}`);
      console.log("Starting research...");
      const plan = await this.planSearches(query);
      updates.push("Searches planned, starting to search...");
      const results = await this.performSearches(plan);
      updates.push("Searches complete, writing report...");
      report = await this.writeReport(query, results);
      updates.push("Report written, sending email...");
      await this.sendEmail(report);
      updates.push("Email sent, research complete");
    }, { traceId });
    // drain updates while the work runs, so the UI sees progress as it happens
    let done = false;
    work.finally(() => (done = true));
    let sent = 0;
    while (!done || sent < updates.length) {
      if (sent < updates.length) yield updates[sent++]!;
      else await new Promise((r) => setTimeout(r, 100));
    }
    await work; // rethrow if the workflow failed
    if (report) yield report.markdown_report;
  }

  /** Plan the searches to perform for the query */
  async planSearches(query: string): Promise<WebSearchPlan> {
    console.log("Planning searches...");
    const result = await run(plannerAgent, `Query: ${query}`);
    const plan = result.finalOutput!;
    console.log(`Will perform ${plan.searches.length} searches`);
    return plan;
  }

  /** Perform the searches for the plan, in parallel; report progress as each one completes */
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

  /** Perform one search; a failed search returns null instead of killing the whole run */
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
