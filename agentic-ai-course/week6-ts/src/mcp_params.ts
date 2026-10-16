// Port of 6_mcp/mcp_params.py — how to launch every MCP server the trader and the researcher use.
// Differences: our own servers run with "node --import tsx <file>" instead of "uv run <file>.py", and the Brave
// search server is only included when BRAVE_API_KEY is set (it exits at start-up without a key, which would stop
// the whole trader run). Third-party servers are the same commands as the course, plus networkEnv (see setup.ts).
import { config } from "dotenv";
import { isPaidPolygon, isRealtimePolygon } from "./market.js";
import { networkEnv } from "./setup.js";

config({ override: true, quiet: true });

export type StdioParams = { command: string; args: string[]; env?: Record<string, string> };

const braveApiKey = process.env.BRAVE_API_KEY;
const polygonApiKey = process.env.POLYGON_API_KEY ?? "";

/** One of our own TypeScript servers, started with the current Node and tsx. */
const tsx = (file: string): StdioParams => ({ command: process.execPath, args: ["--import", "tsx", file] });

// The MCP server for the Trader to read Market Data

export const marketMcp: StdioParams =
  isPaidPolygon || isRealtimePolygon
    ? {
        command: "uvx",
        args: ["--from", "git+https://github.com/polygon-io/mcp_polygon@v0.1.0", "mcp_polygon"],
        env: { ...networkEnv, POLYGON_API_KEY: polygonApiKey },
      }
    : tsx("src/market_server.ts");

// The full set of MCP servers for the trader: Accounts, Push Notification and the Market

export const traderMcpServerParams: StdioParams[] = [tsx("src/accounts_server.ts"), tsx("src/push_server.ts"), marketMcp];

// The full set of MCP servers for the researcher: Fetch, Brave Search and Memory

export function researcherMcpServerParams(name: string): StdioParams[] {
  return [
    { command: "uvx", args: ["mcp-server-fetch"], env: networkEnv },
    ...(braveApiKey
      ? [{ command: "npx", args: ["-y", "@modelcontextprotocol/server-brave-search"], env: { ...networkEnv, BRAVE_API_KEY: braveApiKey } }]
      : []),
    { command: "npx", args: ["-y", "mcp-memory-libsql"], env: { ...networkEnv, LIBSQL_URL: `file:./memory/${name}.db` } },
  ];
}
