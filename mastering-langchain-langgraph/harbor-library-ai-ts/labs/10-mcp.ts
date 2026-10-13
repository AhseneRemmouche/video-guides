// Lab 10: connect to the catalog's MCP server and give its tools to an agent.
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { createAgent } from "langchain";
import { ROOT, getModel } from "../src/config.js";
import { printRun } from "../src/show.js";

const client = new MultiServerMCPClient({
  mcpServers: {
    catalog: {
      transport: "stdio", // start the server as a child process and talk over stdin/stdout
      command: process.execPath, // the same Node that runs this lab
      args: ["--import", "tsx", "src/mcp-server.ts"], // tsx lets Node run the TypeScript file directly
      cwd: ROOT,
    },
  },
});

try {
  const tools = await client.getTools();
  console.log("1) Tools discovered over MCP:");
  for (const t of tools) console.log(`   ${t.name}: ${t.description}`);

  const [genres] = await client.readResource("catalog", "catalog://genres");
  console.log("\n2) Resource catalog://genres:", "text" in genres ? genres.text : "(binary)");

  const agent = createAgent({ model: getModel(), tools, systemPrompt: "You help visitors of Harbor City Library. Use the tools." });
  const result = await agent.invoke({ messages: [{ role: "user", content: "Is there a book about radios, and can I borrow it today?" }] });
  console.log("\n3) Agent run:");
  printRun(result.messages.slice(1));
} finally {
  await client.close(); // stops the server process
}
