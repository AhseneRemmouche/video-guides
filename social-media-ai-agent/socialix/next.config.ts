import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pg and the MCP SDK's stdio transport are Node-only; keep them out of the bundle.
  serverExternalPackages: ["pg", "@modelcontextprotocol/sdk"],
};

export default nextConfig;
