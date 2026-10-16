// Shared setup for the labs and the trading floor: environment variables, the model to use, and an optional local-model mode.
//
// Default (like the course): OPENAI_API_KEY in .env, the Responses API and tracing on platform.openai.com.
// Local mode (no OpenAI key): set OPENAI_BASE_URL=http://localhost:11434/v1 OPENAI_API_KEY=ollama MODEL=llama3.2
// The SDK then talks Chat Completions to Ollama's OpenAI-compatible endpoint. Traces stay on this machine:
// the OpenAI upload is removed (it needs a real key), but our own LogTracer (tracers.ts) can still be added.
import { config } from "dotenv";
import OpenAI from "openai";
import { setDefaultOpenAIClient, setOpenAIAPI, setTraceProcessors } from "@openai/agents";

config({ override: true, quiet: true }); // load_dotenv(override=True)

export const LOCAL = Boolean(process.env.OPENAI_BASE_URL);

/** The model a lab uses: the course's choice, unless MODEL is set (for example MODEL=llama3.2 in local mode). */
export const model = (courseModel: string) => process.env.MODEL ?? courseModel;

/** Not in the course: an MCP server started with npx or uvx only inherits a few variables (PATH, HOME, ...). These pass on
 *  certificate and proxy settings, so the servers can still download behind a company proxy or an antivirus TLS scanner. */
const NETWORK_VARS = ["NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "UV_SYSTEM_CERTS", "UV_NATIVE_TLS", "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY"];
export const networkEnv: Record<string, string> = Object.fromEntries(
  NETWORK_VARS.filter((v) => process.env[v]).map((v) => [v, process.env[v]!]),
);

if (LOCAL) {
  setDefaultOpenAIClient(new OpenAI({ baseURL: process.env.OPENAI_BASE_URL, apiKey: process.env.OPENAI_API_KEY ?? "ollama" }));
  setOpenAIAPI("chat_completions");
  setTraceProcessors([]); // no upload to OpenAI; trading_floor.ts adds LogTracer on top
}
