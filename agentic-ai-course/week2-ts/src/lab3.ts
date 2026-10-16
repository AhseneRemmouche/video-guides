// Week 2 Day 3 — other models, structured outputs and guardrails (TypeScript version of 2_openai/3_lab3.ipynb)
import OpenAI from "openai";
import { Agent, InputGuardrailTripwireTriggered, OpenAIChatCompletionsModel, run, tool, withTrace } from "@openai/agents";
import type { InputGuardrail } from "@openai/agents";
import { z } from "zod";
import { LOCAL, MODEL, sendEmail } from "./setup.js";

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

// ---------- It's easy to use any model with an OpenAI-compatible endpoint ----------
// Python: AsyncOpenAI(base_url, api_key) + OpenAIChatCompletionsModel(model=..., openai_client=...)
// TypeScript: new OpenAI({ baseURL, apiKey }) + new OpenAIChatCompletionsModel(client, "model-name")
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

function providerModel(baseURL: string, apiKey: string | undefined, modelName: string) {
  if (LOCAL) {
    // local stand-in: every "provider" is the same Ollama server, so the code path is exercised without any keys
    const client = new OpenAI({ baseURL: process.env.OPENAI_BASE_URL, apiKey: "ollama" });
    return new OpenAIChatCompletionsModel(client, MODEL);
  }
  return new OpenAIChatCompletionsModel(new OpenAI({ baseURL, apiKey }), modelName);
}
const deepseekModel = providerModel(DEEPSEEK_BASE_URL, process.env.DEEPSEEK_API_KEY, "deepseek-chat");
const geminiModel = providerModel(GEMINI_BASE_URL, process.env.GOOGLE_API_KEY, "gemini-2.0-flash");
const llama33Model = providerModel(GROQ_BASE_URL, process.env.GROQ_API_KEY, "llama-3.3-70b-versatile");

const salesAgent1 = new Agent({ name: "DeepSeek Sales Agent", instructions: instructions1, model: deepseekModel });
const salesAgent2 = new Agent({ name: "Gemini Sales Agent", instructions: instructions2, model: geminiModel });
const salesAgent3 = new Agent({ name: "Llama3.3 Sales Agent", instructions: instructions3, model: llama33Model });

const description = "Write a cold sales email";
const tool1 = salesAgent1.asTool({ toolName: "sales_agent1", toolDescription: description });
const tool2 = salesAgent2.asTool({ toolName: "sales_agent2", toolDescription: description });
const tool3 = salesAgent3.asTool({ toolName: "sales_agent3", toolDescription: description });

const sendHtmlEmail = tool({
  name: "send_html_email",
  description: "Send out an email with the given subject and HTML body to all sales prospects",
  parameters: z.object({ subject: z.string(), html_body: z.string() }),
  execute: async ({ subject, html_body }) => sendEmail(subject, html_body, "text/html"),
});

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

const salesManager = new Agent({
  name: "Sales Manager",
  instructions: salesManagerInstructions,
  tools: [tool1, tool2, tool3],
  handoffs: [emailerAgent],
  model: MODEL,
});

await withTrace("Automated SDR", async () => {
  const result = await run(salesManager, "Send out a cold sales email addressed to Dear CEO from Alice");
  console.log("Automated SDR done. Last agent:", result.lastAgent?.name);
});

// ---------- Structured outputs + an input guardrail ----------
// Python: a Pydantic BaseModel as output_type. TypeScript: a zod schema as outputType.
const NameCheckOutput = z.object({ is_name_in_message: z.boolean(), name: z.string() });

const guardrailAgent = new Agent({
  name: "Name check",
  instructions: "Check if the user is including someone's personal name in what they want you to do.",
  outputType: NameCheckOutput,
  model: MODEL,
});

// Python: @input_guardrail async def guardrail_against_name(ctx, agent, message) -> GuardrailFunctionOutput
// TypeScript: an object with a name and an execute function returning { outputInfo, tripwireTriggered }
const guardrailAgainstName: InputGuardrail = {
  name: "guardrail_against_name",
  execute: async ({ input, context }) => {
    const text = typeof input === "string" ? input : JSON.stringify(input);
    const result = await run(guardrailAgent, text, { context: context.context });
    const found = result.finalOutput;
    return { outputInfo: { found_name: found }, tripwireTriggered: found?.is_name_in_message ?? false };
  },
};

const carefulSalesManager = new Agent({
  name: "Sales Manager",
  instructions: salesManagerInstructions,
  tools: [tool1, tool2, tool3],
  handoffs: [emailerAgent],
  model: MODEL,
  inputGuardrails: [guardrailAgainstName],
});

await withTrace("Protected Automated SDR", async () => {
  try {
    await run(carefulSalesManager, "Send out a cold sales email addressed to Dear CEO from Alice");
    console.log("No tripwire (the guardrail did not spot a name)");
  } catch (e) {
    if (e instanceof InputGuardrailTripwireTriggered) {
      console.log("Guardrail tripwire triggered:", JSON.stringify(e.result.output.outputInfo));
    } else throw e;
  }
});

await withTrace("Protected Automated SDR", async () => {
  const result = await run(carefulSalesManager, "Send out a cold sales email addressed to Dear CEO from Head of Business Development");
  console.log("Passed the guardrail. Last agent:", result.lastAgent?.name);
});
