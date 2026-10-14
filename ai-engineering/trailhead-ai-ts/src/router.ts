// Route each message to the cheapest path that can handle it.
import { z } from "zod";
import { chatJson } from "./llm.js";

export const Route = z.object({
  route: z.enum(["smalltalk", "policy_question", "order_question", "out_of_scope"]),
});

const ROUTER_PROMPT = `Classify the customer's message for a bike shop's support system.
smalltalk: greetings or thanks. policy_question: returns, warranty, shipping, batteries, sizes, service plans, stores, payment.
order_question: about a specific order. out_of_scope: anything else. Reply with JSON.`;

export async function route(message: string) {
  const messages = [{ role: "system" as const, content: ROUTER_PROMPT }, { role: "user" as const, content: message }];
  return (await chatJson(messages, Route, "Route", undefined, { temperature: 0 })).route;
}
