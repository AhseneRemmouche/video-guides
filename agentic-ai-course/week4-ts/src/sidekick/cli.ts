// Run one Sidekick super-step from the console: pnpm sidekick "your request" "your success criteria"
// (handy for testing the class without the web app)
import { Sidekick } from "./sidekick.js";

const message = process.argv[2] ?? "What is pi times 3? Use your Python tool to calculate it.";
const criteria = process.argv[3] ?? "The answer is accurate to at least 6 decimal places";

const sidekick = new Sidekick();
await sidekick.setup();
try {
  const history = await sidekick.runSuperstep(message, criteria, []);
  for (const m of history) console.log(`\n[${m.role}] ${m.content}`);
} finally {
  await sidekick.cleanup();
}
