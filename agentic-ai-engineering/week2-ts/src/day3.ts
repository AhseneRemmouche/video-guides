// Week 2 Day 3 - structured output + an input guardrail (TypeScript port of 2_openai/3_lab3.py)
// Python: a Pydantic BaseModel as output_type, and an @input_guardrail function.
// TypeScript: a zod schema as outputType, and an InputGuardrail object with an execute function.
import {
  Agent,
  InputGuardrailTripwireTriggered,
  run,
  tool,
  withTrace,
} from "@openai/agents";
import type { InputGuardrail } from "@openai/agents";
import { z } from "zod";
import { MODEL, sendEmail } from "./setup.js";

// A small sales/email setup reused from day 2, so the guardrail has something to protect.
const salesAgent = new Agent({
  name: "Sales Agent",
  instructions:
    "You are a sales agent working for ComplAI, a company that provides a SaaS tool for ensuring SOC2 " +
    "compliance and preparing for audits, powered by AI. You write concise, professional cold emails.",
  model: MODEL,
});
const salesTool = salesAgent.asTool({ toolName: "sales_agent", toolDescription: "Write a cold sales email" });

const sendHtmlEmail = tool({
  name: "send_html_email",
  description: "Send out an email with the given subject and HTML body to all sales prospects",
  parameters: z.object({ subject: z.string(), html_body: z.string() }),
  execute: async ({ subject, html_body }) => sendEmail(subject, html_body, "text/html"),
});

const emailerAgent = new Agent({
  name: "Email Manager",
  instructions:
    "You are an email formatter and sender. You receive the body of an email, write a subject, convert it to " +
    "clean HTML, and send it with the send_html_email tool.",
  tools: [sendHtmlEmail],
  model: MODEL,
  handoffDescription: "Convert an email to HTML and send it",
});

const salesManagerInstructions = `You are a Sales Manager at ComplAI. Use the sales_agent tool to draft a cold
sales email, then hand off exactly ONE email to the 'Email Manager' agent for formatting and sending.`;

// ---------- Structured output: a zod schema as outputType ----------
// The guardrail agent's final output is typed as NameCheckOutput instead of a free-form string.
const NameCheckOutput = z.object({
  is_name_in_message: z.boolean(),
  name: z.string(),
});

const guardrailAgent = new Agent({
  name: "Name check",
  instructions: "Check if the user is including someone's personal name in what they want you to do.",
  outputType: NameCheckOutput,
  model: MODEL,
});

// ---------- Input guardrail ----------
// Python: @input_guardrail async def guardrail_against_name(ctx, agent, message) -> GuardrailFunctionOutput
// TypeScript: an InputGuardrail with a name and an execute returning { outputInfo, tripwireTriggered }.
const guardrailAgainstName: InputGuardrail = {
  name: "guardrail_against_name",
  execute: async ({ input, context }) => {
    const text = typeof input === "string" ? input : JSON.stringify(input);
    const result = await run(guardrailAgent, text, { context: context?.context });
    const found = result.finalOutput;
    return {
      outputInfo: { found_name: found },
      tripwireTriggered: found?.is_name_in_message ?? false,
    };
  },
};

const carefulSalesManager = new Agent({
  name: "Sales Manager",
  instructions: salesManagerInstructions,
  tools: [salesTool],
  handoffs: [emailerAgent],
  model: MODEL,
  inputGuardrails: [guardrailAgainstName],
});

// A message containing a personal name trips the guardrail before any work is done.
await withTrace("Protected Automated SDR (name present)", async () => {
  try {
    await run(carefulSalesManager, "Send out a cold sales email addressed to Dear CEO from Alice");
    console.log("No tripwire (the guardrail did not spot a name)");
  } catch (e) {
    if (e instanceof InputGuardrailTripwireTriggered) {
      console.log("Guardrail tripwire triggered:", JSON.stringify(e.result.output.outputInfo));
    } else {
      throw e;
    }
  }
});

// A message with no personal name passes the guardrail and runs normally.
await withTrace("Protected Automated SDR (no name)", async () => {
  const result = await run(
    carefulSalesManager,
    "Send out a cold sales email addressed to Dear CEO from Head of Business Development",
  );
  console.log("Passed the guardrail. Last agent:", result.lastAgent?.name);
});
