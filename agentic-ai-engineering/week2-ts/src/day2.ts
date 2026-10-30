// Week 2 Day 2 - tools, agents-as-tools and a handoff (TypeScript port of 2_openai/2_lab2.py)
// Three ideas, in order:
//   1. a function tool made with tool({ name, description, parameters: z.object(), execute })
//   2. agents wrapped as tools with agent.asTool(...), driven by a Sales Manager
//   3. a handoff: the manager passes the winning email to an Email Manager that formats and sends it
import { Agent, run, tool, withTrace } from "@openai/agents";
import { z } from "zod";
import { MODEL, sendEmail } from "./setup.js";

// Three sales agents with different styles.
const instructions1 =
  "You are a sales agent working for ComplAI, a company that provides a SaaS tool for ensuring SOC2 " +
  "compliance and preparing for audits, powered by AI. You write professional, serious cold emails.";
const instructions2 =
  "You are a humorous, engaging sales agent working for ComplAI, a company that provides a SaaS tool " +
  "for ensuring SOC2 compliance and preparing for audits, powered by AI. You write witty, engaging cold " +
  "emails that are likely to get a response.";
const instructions3 =
  "You are a busy sales agent working for ComplAI, a company that provides a SaaS tool for ensuring SOC2 " +
  "compliance and preparing for audits, powered by AI. You write concise, to the point cold emails.";

const salesAgent1 = new Agent({ name: "Professional Sales Agent", instructions: instructions1, model: MODEL });
const salesAgent2 = new Agent({ name: "Engaging Sales Agent", instructions: instructions2, model: MODEL });
const salesAgent3 = new Agent({ name: "Busy Sales Agent", instructions: instructions3, model: MODEL });

// ---------- 1. A function tool ----------
// Python wraps a function with @function_tool and reads its docstring + type hints.
// TypeScript has no runtime types, so tool() takes a zod schema that describes the parameters.
const sendEmailTool = tool({
  name: "send_email",
  description: "Send out an email with the given body to all sales prospects",
  parameters: z.object({ body: z.string() }),
  execute: async ({ body }) => sendEmail("Sales email", body),
});

// ---------- 2. Agents as tools ----------
// Calling the tool runs the agent and returns its final output as the tool result.
const description = "Write a cold sales email";
const tool1 = salesAgent1.asTool({ toolName: "sales_agent1", toolDescription: description });
const tool2 = salesAgent2.asTool({ toolName: "sales_agent2", toolDescription: description });
const tool3 = salesAgent3.asTool({ toolName: "sales_agent3", toolDescription: description });

// An Email Manager that formats and sends email. It owns two agent-tools and one function tool,
// and advertises a handoffDescription so other agents know when to hand off to it.
const subjectWriter = new Agent({
  name: "Email subject writer",
  instructions:
    "You can write a subject for a cold sales email. You are given a message and you need to write a " +
    "subject for an email that is likely to get a response.",
  model: MODEL,
});
const subjectTool = subjectWriter.asTool({
  toolName: "subject_writer",
  toolDescription: "Write a subject for a cold sales email",
});

const htmlConverter = new Agent({
  name: "HTML email body converter",
  instructions:
    "You can convert a text email body to an HTML email body. You are given a text email body which might " +
    "have some markdown and you need to convert it to an HTML email body with simple, clear, compelling layout.",
  model: MODEL,
});
const htmlTool = htmlConverter.asTool({
  toolName: "html_converter",
  toolDescription: "Convert a text email body to an HTML email body",
});

const sendHtmlEmail = tool({
  name: "send_html_email",
  description: "Send out an email with the given subject and HTML body to all sales prospects",
  parameters: z.object({ subject: z.string(), html_body: z.string() }),
  execute: async ({ subject, html_body }) => sendEmail(subject, html_body, "text/html"),
});

const emailerAgent = new Agent({
  name: "Email Manager",
  instructions:
    "You are an email formatter and sender. You receive the body of an email to be sent. You first use the " +
    "subject_writer tool to write a subject for the email, then use the html_converter tool to convert the " +
    "body to HTML. Finally, you use the send_html_email tool to send the email with the subject and HTML body.",
  tools: [subjectTool, htmlTool, sendHtmlEmail],
  model: MODEL,
  handoffDescription: "Convert an email to HTML and send it",
});

// ---------- 3. The Sales Manager: tools + a handoff ----------
// It uses the three sales_agent tools to draft, picks the best, then hands off to the Email Manager.
const salesManagerInstructions = `You are a Sales Manager at ComplAI. Your goal is to find the single best cold sales email using the sales_agent tools.

Follow these steps carefully:
1. Generate Drafts: Use all three sales_agent tools to generate three different email drafts. Do not proceed until all three drafts are ready.
2. Evaluate and Select: Review the drafts and choose the single best email using your judgment of which one is most effective.
3. Handoff for Sending: Pass ONLY the winning email draft to the 'Email Manager' agent. The Email Manager will take care of formatting and sending.

Crucial Rules:
- You must use the sales agent tools to generate the drafts - do not write them yourself.
- You must hand off exactly ONE email to the Email Manager - never more than one.`;

const salesManager = new Agent({
  name: "Sales Manager",
  instructions: salesManagerInstructions,
  tools: [tool1, tool2, tool3],
  handoffs: [emailerAgent],
  model: MODEL,
});

// A standalone demo of the plain function tool (not used by the manager, but shown here).
void sendEmailTool;

await withTrace("Automated SDR", async () => {
  const result = await run(salesManager, "Send out a cold sales email addressed to Dear CEO from Alice");
  console.log("Last agent:", result.lastAgent?.name);
  console.log("Final output:", result.finalOutput);
});
