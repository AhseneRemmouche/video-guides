// Lab 03: turn a free-text customer message into validated JSON.
import { z } from "zod";
import { chatJson } from "../src/llm.js";

const Ticket = z.object({
  intent: z.enum(["return", "warranty", "shipping", "order_status", "other"]),
  order_id: z.string().nullable().describe("Order number like TH-10234, or null if none is given"),
  urgent: z.boolean(),
  summary: z.string().describe("One short sentence"),
});

const SYSTEM = "Extract a support ticket from the customer's message. Reply with JSON only.";
const messages = [
  "Hi, my order TH-10251 still hasn't arrived and I need the helmet for a race on Saturday!",
  "The battery of my Volt won't charge since yesterday, the light blinks red.",
  "Do you have stores in Paris?",
];

for (const text of messages) {
  const ticket = await chatJson([{ role: "system", content: SYSTEM }, { role: "user", content: text }], Ticket, "Ticket", undefined, { temperature: 0 });
  console.log(text);
  console.log("  ->", ticket);
}
