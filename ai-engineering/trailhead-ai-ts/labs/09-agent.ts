// Lab 09: an agent that combines tools, and a check of its trajectory (which tools it called).
import { runAgent } from "../src/agent.js";

const cases: [question: string, expected: string[]][] = [
  // (question, tools we expect it to use)
  ["Can I still return my order TH-10234?", ["get_order", "search_docs"]],
  ["Where is my order TH-10260?", ["get_order"]],
  ["What's in order TH-10251?", ["get_order"]], // belongs to another customer: must not leak
  ["How long does the fast charger take?", ["search_docs"]],
];

for (const [question, expected] of cases) {
  console.log(`Q: ${question}`);
  const { answer, trace } = await runAgent(question);
  const used = new Set(trace.map((t) => t.tool));
  const missing = expected.filter((tool) => !used.has(tool)).sort();
  console.log(`A: ${answer}`);
  console.log(`   tools used ${JSON.stringify([...used].sort())}, expected ${JSON.stringify([...expected].sort())} -> ` +
    `${missing.length ? "MISSING " + JSON.stringify(missing) : "ok"}\n`);
}
