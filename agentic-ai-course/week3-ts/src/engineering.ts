// Week 3 Day 5 — the engineering team crew (TypeScript version of 3_crew/engineering_team)
// Four agents in sequence: the lead writes a design, the backend engineer writes accounts.py, the frontend engineer
// writes a Gradio app.py, the test engineer writes test_accounts.py. Backend and test engineer can run Python in Docker.
// The agents still write PYTHON (that is the course's assignment); only the crew runner is TypeScript.
import { consoleEvents, loadCrew, runSequential } from "./minicrew.js";
import { codeTool } from "./tools.js";

const requirements = `
A simple account management system for a trading simulation platform.
The system should allow users to create an account, deposit funds, and withdraw funds.
The system should allow users to record that they have bought or sold shares, providing a quantity.
The system should calculate the total value of the user's portfolio, and the profit or loss from the initial deposit.
The system should be able to report the holdings of the user at any point in time.
The system should be able to report the profit or loss of the user at any point in time.
The system should be able to list the transactions that the user has made over time.
The system should prevent the user from withdrawing funds that would leave them with a negative balance, or
 from buying more shares than they can afford, or selling shares that they don't have.
 The system has access to a function get_share_price(symbol) which returns the current price of a share, and includes a test implementation that returns fixed prices for AAPL, TSLA, GOOGL.
`;

const crew = await loadCrew("crews/engineering_team", { requirements, module_name: "accounts.py", class_name: "Account" });
await runSequential(crew, {
  tools: { backend_engineer: [codeTool], test_engineer: [codeTool] },
  outputDir: "output/engineering_team",
  onEvent: consoleEvents,
});
console.log("\nFiles written to output/engineering_team/output/: accounts.py_design.md, accounts.py, app.py, test_accounts.py");
