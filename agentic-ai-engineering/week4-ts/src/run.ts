// Week 4 - the Sidekick CLI entry (LangGraph.js port of app.py's role).
//
// The course runs the Sidekick behind a Gradio UI. Here the UI is the React app
// (see web/ and server/index.ts); this file is the command-line way to drive the same
// Sidekick graph, which is handy for a quick local check.
//
// Usage:
//   npm run sidekick -- "your request" "your success criteria"
//   npm run sidekick                     (uses a built-in demo request)
import { Sidekick } from "./sidekick.js";

async function main() {
  const [, , messageArg, criteriaArg] = process.argv;
  const message =
    messageArg ?? "Use the calculator to work out a 15% tip on a $120 bill, then state the tip amount.";
  const successCriteria =
    criteriaArg ?? "The reply states the tip amount in dollars for a 15% tip on $120.";

  // Each session is its own Sidekick: own tools, own graph, own memory thread.
  const sidekick = new Sidekick();
  await sidekick.setup();

  console.log("Graph:\n" + (await sidekick.mermaid()) + "\n");
  console.log("Request        :", message);
  console.log("Success criteria:", successCriteria, "\n");

  const result = await sidekick.run(message, successCriteria);
  console.log("Worker answer  :", result.answer);
  console.log("Evaluator      :", result.feedback);
  console.log("Criteria met   :", result.success_criteria_met);
  console.log("Input needed   :", result.user_input_needed);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
