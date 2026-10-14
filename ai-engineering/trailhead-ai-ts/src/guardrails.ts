// Checks that run before the model sees a message (input) and before the customer sees a reply (output).
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const PHONE = /(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/g;
const CARD = /\b\d(?:[ -]?\d){12,18}\b/g;

const INJECTION_PATTERNS = [
  /ignore (all |your |the )?(previous |above )?(instructions|rules)/i,
  /you are now/i,
  /system prompt/i,
  /developer mode/i,
  /reveal .*(prompt|instructions)/i,
];

/** Replace personal data with placeholders before it is sent to a model or written to logs. */
export function redactPii(text: string): string {
  return text.replace(CARD, "[CARD]").replace(EMAIL, "[EMAIL]").replace(PHONE, "[PHONE]");
}

export function looksLikeInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

export interface InputCheck {
  allowed: boolean;
  cleaned: string;
  reason: string;
}

export function checkInput(text: string): InputCheck {
  if (text.length > 2000) return { allowed: false, cleaned: text, reason: "message too long" };
  if (looksLikeInjection(text)) return { allowed: false, cleaned: text, reason: "possible prompt injection" };
  return { allowed: true, cleaned: redactPii(text), reason: "" };
}

export interface OutputCheck {
  allowed: boolean;
  reason: string;
}

/** A grounded answer must cite only chunks it was given. */
export function checkOutput(answer: string, allowedChunkIds: string[]): OutputCheck {
  const cited = new Set([...answer.matchAll(/\[([a-z-]+#\d+)\]/g)].map((m) => m[1]!));
  if (answer.toLowerCase().includes("i don't know")) return { allowed: true, reason: "" };
  if (!cited.size) return { allowed: false, reason: "no citation" };
  const unknown = [...cited].filter((id) => !allowedChunkIds.includes(id)).sort();
  if (unknown.length) return { allowed: false, reason: `cites chunks it was not given: ${JSON.stringify(unknown)}` };
  if (/\b(free bikes?|FREEBIKE)\b/i.test(answer)) return { allowed: false, reason: "promises something the shop never offers" };
  return { allowed: true, reason: "" };
}
