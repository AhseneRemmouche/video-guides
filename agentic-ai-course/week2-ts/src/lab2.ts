// Week 2 Day 2 — a Sales Development Rep in three layers (TypeScript version of 2_openai/2_lab2.ipynb)
//   1. an agent workflow written by hand (three writers in parallel, then a picker)
//   2. tools: a function tool, and agents wrapped as tools, used by a Sales Manager
//   3. a handoff: the manager passes the winning email to an Email Manager that formats and sends it
import { Agent, run, tool, withTrace } from "@openai/agents";
import { z } from "zod";
import { MODEL, sendEmail } from "./setup.js";

// ---------- Step 1: agent workflow ----------
const instructions1 =
  "You are a sales agent working for ComplAI, " +
  "a company that provides a SaaS tool for ensuring SOC2 compliance and preparing for audits, powered by AI. " +
  "You write professional, serious cold emails.";
const instructions2 =
  "You are a humorous, engaging sales agent working for ComplAI, " +
  "a company that provides a SaaS tool for ensuring SOC2 compliance and preparing for audits, powered by AI. " +
  "You write witty, engaging cold emails that are likely to get a response.";
const instructions3 =
  "You are a busy sales agent working for ComplAI, " +
  "a company that provides a SaaS tool for ensuring SOC2 compliance and preparing for audits, powered by AI. " +
  "You write concise, to the point cold emails.";

const salesAgent1 = new Agent({ name: "Professional Sales Agent", instructions: instructions1, model: MODEL });
const salesAgent2 = new Agent({ name: "Engaging Sales Agent", instructions: instructions2, model: MODEL });
const salesAgent3 = new Agent({ name: "Busy Sales Agent", instructions: instructions3, model: MODEL });

// Streaming: Python's Runner.run_streamed + "async for event" becomes run(..., { stream: true }) + toTextStream()
console.log("--- streamed email from the professional agent ---");
const streamed = await run(salesAgent1, "Write a cold sales email", { stream: true });
for await (const chunk of streamed.toTextStream()) process.stdout.write(chunk);
await streamed.completed;
console.log("\n");

// Three runs at the same time: Python's asyncio.gather is Promise.all in JavaScript
const message = "Write a cold sales email";
await withTrace("Parallel cold emails", async () => {
  const results = await Promise.all([run(salesAgent1, message), run(salesAgent2, message), run(salesAgent3, message)]);
  for (const r of results) console.log(r.finalOutput + "\n\n");
});

const salesPicker = new Agent({
  name: "sales_picker",
  instructions:
    "You pick the best cold sales email from the given options. " +
    "Imagine you are a customer and pick the one you are most likely to respond to. " +
    "Do not give an explanation; reply with the selected email only.",
  model: MODEL,
});

await withTrace("Selection from sales people", async () => {
  const results = await Promise.all([run(salesAgent1, message), run(salesAgent2, message), run(salesAgent3, message)]);
  const outputs = results.map((r) => r.finalOutput ?? "");
  const emails = "Cold sales emails:\n\n" + outputs.join("\n\nEmail:\n\n");
  const best = await run(salesPicker, emails);
  console.log(`Best sales email:\n${best.finalOutput}`);
});

// ---------- Steps 2 and 3: tools and agent interactions ----------
// Python wraps a function with @function_tool and reads the docstring + type hints.
// TypeScript has no runtime types, so the tool() helper takes a zod schema for the parameters.
const sendEmailTool = tool({
  name: "send_email",
  description: "Send out an email with the given body to all sales prospects",
  parameters: z.object({ body: z.string() }),
  execute: async ({ body }) => sendEmail("Sales email", body),
});

// An agent can also be a tool: calling the tool runs the agent and returns its final output
const description = "Write a cold sales email";
const tool1 = salesAgent1.asTool({ toolName: "sales_agent1", toolDescription: description });
const tool2 = salesAgent2.asTool({ toolName: "sales_agent2", toolDescription: description });
const tool3 = salesAgent3.asTool({ toolName: "sales_agent3", toolDescription: description });

// The Sales Manager: a planning agent that decides which tools to call and when
const managerInstructions = `
You are a Sales Manager at ComplAI. Your goal is to find the single best cold sales email using the sales_agent tools.

Follow these steps carefully:
1. Generate Drafts: Use all three sales_agent tools to generate three different email drafts. Do not proceed until all three drafts are ready.

2. Evaluate and Select: Review the drafts and choose the single best email using your judgment of which one is most effective.

3. Use the send_email tool to send the best email (and only the best email) to the user.

Crucial Rules:
- You must use the sales agent tools to generate the drafts — do not write them yourself.
- You must send ONE email using the send_email tool — never more than one.
`;
const salesManager = new Agent({
  name: "Sales Manager",
  instructions: managerInstructions,
  tools: [tool1, tool2, tool3, sendEmailTool],
  model: MODEL,
});

await withTrace("Sales manager", async () => {
  const result = await run(salesManager, "Send a cold sales email addressed to 'Dear CEO'");
  console.log("Manager finished:", result.finalOutput);
});

// ---------- Handoffs: control passes across, not back ----------
const subjectWriter = new Agent({
  name: "Email subject writer",
  instructions:
    "You can write a subject for a cold sales email. " +
    "You are given a message and you need to write a subject for an email that is likely to get a response.",
  model: MODEL,
});
const subjectTool = subjectWriter.asTool({ toolName: "subject_writer", toolDescription: "Write a subject for a cold sales email" });

const htmlConverter = new Agent({
  name: "HTML email body converter",
  instructions:
    "You can convert a text email body to an HTML email body. " +
    "You are given a text email body which might have some markdown " +
    "and you need to convert it to an HTML email body with simple, clear, compelling layout and design.",
  model: MODEL,
});
const htmlTool = htmlConverter.asTool({ toolName: "html_converter", toolDescription: "Convert a text email body to an HTML email body" });

const sendHtmlEmail = tool({
  name: "send_html_email",
  description: "Send out an email with the given subject and HTML body to all sales prospects",
  parameters: z.object({ subject: z.string(), html_body: z.string() }),
  execute: async ({ subject, html_body }) => sendEmail(subject, html_body, "text/html"),
});

const emailerAgent = new Agent({
  name: "Email Manager",
  instructions:
    "You are an email formatter and sender. You receive the body of an email to be sent. " +
    "You first use the subject_writer tool to write a subject for the email, then use the html_converter tool to convert the body to HTML. " +
    "Finally, you use the send_html_email tool to send the email with the subject and HTML body.",
  tools: [subjectTool, htmlTool, sendHtmlEmail],
  model: MODEL,
  handoffDescription: "Convert an email to HTML and send it",
});

const salesManagerInstructions = `
You are a Sales Manager at ComplAI. Your goal is to find the single best cold sales email using the sales_agent tools.

Follow these steps carefully:
1. Generate Drafts: Use all three sales_agent tools to generate three different email drafts. Do not proceed until all three drafts are ready.

2. Evaluate and Select: Review the drafts and choose the single best email using your judgment of which one is most effective.
You can use the tools multiple times if you're not satisfied with the results from the first try.

3. Handoff for Sending: Pass ONLY the winning email draft to the 'Email Manager' agent. The Email Manager will take care of formatting and sending.

Crucial Rules:
- You must use the sales agent tools to generate the drafts — do not write them yourself.
- You must hand off exactly ONE email to the Email Manager — never more than one.
`;
const salesManagerWithHandoff = new Agent({
  name: "Sales Manager",
  instructions: salesManagerInstructions,
  tools: [tool1, tool2, tool3],
  handoffs: [emailerAgent],
  model: MODEL,
});

await withTrace("Automated SDR", async () => {
  const result = await run(salesManagerWithHandoff, "Send out a cold sales email addressed to Dear CEO from Alice");
  console.log("Last agent:", result.lastAgent?.name);
  console.log("Final output:", result.finalOutput);
});
