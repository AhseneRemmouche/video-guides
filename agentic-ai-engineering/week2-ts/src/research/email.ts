// The email agent (TypeScript port of 2_openai/deep_research/email_agent.py).
// A stub sender: the function tool hands off to setup.sendEmail, which prints the email unless a
// SENDGRID_API_KEY is configured. The agent converts the report to HTML and sends one email.
import { Agent, tool } from "@openai/agents";
import { z } from "zod";
import { MODEL, sendEmail } from "../setup.js";

const sendEmailTool = tool({
  name: "send_email",
  description: "Send an email with the given subject and HTML body",
  parameters: z.object({ subject: z.string(), html_body: z.string() }),
  execute: async ({ subject, html_body }) => sendEmail(subject, html_body, "text/html"),
});

export const emailAgent = new Agent({
  name: "Email agent",
  instructions:
    "You are able to send a nicely formatted HTML email based on a detailed report.\n" +
    "You will be provided with a detailed report. You should use your tool to send one email, providing the " +
    "report converted into clean, well presented HTML with an appropriate subject line.",
  tools: [sendEmailTool],
  model: MODEL,
});
