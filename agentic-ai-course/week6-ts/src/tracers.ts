// Port of 6_mcp/tracers.py — a custom tracing processor that writes every trace and span to the logs table,
// so the dashboard can show what each trader is doing. The trader's name is hidden inside the trace id:
// "trace_" + "warren0" + random characters, and getName() reads it back (everything before the first "0").
// Differences: TracingProcessor is an interface in the TS SDK (implements, not inheritance), its methods are async
// and camelCase (onSpanStart), and span fields are getters (span.spanData, span.traceId).
import { randomInt } from "node:crypto";
import type { Span, Trace, TracingProcessor } from "@openai/agents";
import { writeLog } from "./database.js";

const ALPHANUM = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Return a string of the form 'trace_<tag><random>', where the total length after 'trace_' is 32 chars. */
export function makeTraceId(tag: string): string {
  tag += "0";
  const padLen = 32 - tag.length;
  let randomSuffix = "";
  for (let i = 0; i < padLen; i++) randomSuffix += ALPHANUM[randomInt(ALPHANUM.length)];
  return `trace_${tag}${randomSuffix}`;
}

export class LogTracer implements TracingProcessor {
  getName(traceOrSpan: Trace | Span<any>): string | null {
    const name = traceOrSpan.traceId.split("_")[1] ?? "";
    return name.includes("0") ? name.split("0")[0] : null;
  }

  async onTraceStart(trace: Trace): Promise<void> {
    const name = this.getName(trace);
    if (name) writeLog(name, "trace", `Started: ${trace.name}`);
  }

  async onTraceEnd(trace: Trace): Promise<void> {
    const name = this.getName(trace);
    if (name) writeLog(name, "trace", `Ended: ${trace.name}`);
  }

  /** "Started function lookup_share_price", "Ended mcp_tools accounts_server", ... */
  private describe(span: Span<any>, verb: string): string {
    const data = span.spanData as { type?: string; name?: string; server?: string } | undefined;
    let message = verb;
    if (data?.type) message += ` ${data.type}`;
    if (data?.name) message += ` ${data.name}`;
    if (data?.server) message += ` ${data.server}`;
    if (span.error) message += ` ${JSON.stringify(span.error)}`;
    return message;
  }

  async onSpanStart(span: Span<any>): Promise<void> {
    const name = this.getName(span);
    if (name) writeLog(name, span.spanData?.type ?? "span", this.describe(span, "Started"));
  }

  async onSpanEnd(span: Span<any>): Promise<void> {
    const name = this.getName(span);
    if (name) writeLog(name, span.spanData?.type ?? "span", this.describe(span, "Ended"));
  }

  async forceFlush(): Promise<void> {}

  async shutdown(): Promise<void> {}
}
