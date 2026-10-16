// Port of 6_mcp/4_lab4.ipynb cell 30: "How many tools did we use in total?" Opens every trader and researcher MCP server
// in turn and counts their tools. Needs no API key (only uvx and npx for the third-party servers).
// Run: pnpm count-tools
import { MCPServerStdio } from "@openai/agents";
import { researcherMcpServerParams, traderMcpServerParams } from "./mcp_params.js";

const allParams = [...traderMcpServerParams, ...researcherMcpServerParams("ed")];
let count = 0;
for (const params of allParams) {
  const server = new MCPServerStdio({ ...params, clientSessionTimeoutSeconds: 60 });
  await server.connect();
  try {
    const tools = await server.listTools();
    console.log(`${params.command} ${params.args.join(" ")}: ${tools.map((t) => t.name).join(", ")}`);
    count += tools.length;
  } finally {
    await server.close();
  }
}
console.log(`We have ${allParams.length} MCP servers, and ${count} tools`);
