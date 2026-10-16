// A teaching stand-in for AutoGen Core's distributed runtime (GrpcWorkerAgentRuntimeHost + GrpcWorkerAgentRuntime).
// AutoGen has no JavaScript version, and its real host and workers talk gRPC. Here they talk plain HTTP + JSON with Hono,
// which keeps the same architecture visible in ~100 lines:
//
//   host    (WorkerAgentRuntimeHost, localhost:50051)  keeps a table "agent type -> worker URL" and forwards messages
//   worker  (WorkerAgentRuntime)                       runs its own little HTTP server, advertises its agent types to
//                                                      the host, and runs those agents' code when a message arrives
//
// Agents do not change at all: they still call this.sendMessage(msg, agentId). Only the runtime object is different.
// Like AutoGen's (which Microsoft labels experimental), this is not production code: no auth, no retries, no streaming.
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { AgentId, BaseAgentRuntime, messageTypes } from "./runtime.js";

// ---------- Messages on the wire: class name + fields, rebuilt into the right class on the other side ----------
type Wire = { type: string | null; data: unknown };

function toWire(value: unknown): Wire {
  const name = value && typeof value === "object" ? value.constructor.name : null;
  return name && messageTypes.has(name) ? { type: name, data: { ...(value as object) } } : { type: null, data: value };
}

function fromWire(wire: Wire): any {
  const cls = wire.type ? messageTypes.get(wire.type) : undefined;
  if (wire.type && !cls) throw new Error(`Unknown message type ${wire.type}`);
  return cls ? Object.assign(Object.create(cls.prototype), wire.data) : wire.data;
}

const toUrl = (address: string) => `http://${address.replace("localhost", "127.0.0.1")}`;

function listen(app: Hono, port: number): Promise<Server> {
  return new Promise((resolve) => {
    const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port }, () => resolve(server as Server));
  });
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

// ---------- The host service ----------
export class WorkerAgentRuntimeHost {
  private routes = new Map<string, string>(); // agent type -> worker URL
  private server?: Server;

  constructor(private readonly address = "localhost:50051") {}

  async start() {
    const app = new Hono();
    app.post("/register", async (c) => {
      const { type, url } = await c.req.json();
      if (this.routes.has(type)) return c.json({ error: `Agent type ${type} already registered` }, 409);
      this.routes.set(type, url);
      console.log(`[host] ${type} lives at ${url}`);
      return c.json({ ok: true });
    });
    app.get("/agents", (c) => c.json([...this.routes.keys()]));
    // Every message goes through here: look up the recipient's worker and pass the message on
    app.post("/send", async (c) => {
      const body = await c.req.json();
      const url = this.routes.get(body.recipient.type);
      if (!url) return c.json({ error: `No worker has agent type ${body.recipient.type}` }, 404);
      const res = await fetch(`${url}/deliver`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return c.json(await res.json(), res.status as 200);
    });
    this.server = await listen(app, Number(this.address.split(":")[1]));
  }

  /** Wait until workers in other processes have advertised these agent types. */
  async waitFor(types: string[], timeoutMs = 60_000) {
    const end = Date.now() + timeoutMs;
    while (!types.every((t) => this.routes.has(t))) {
      if (Date.now() > end) throw new Error(`Timed out waiting for ${types.join(", ")}`);
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  async stop() {
    this.server?.closeAllConnections();
    this.server?.close();
  }
}

// ---------- A worker runtime ----------
export class WorkerAgentRuntime extends BaseAgentRuntime {
  private server?: Server;
  private url = "";

  constructor(private readonly hostAddress = "localhost:50051") {
    super();
  }

  /** Start this worker's own server (any free port) so the host can deliver messages to it. */
  async start() {
    const app = new Hono();
    app.post("/deliver", async (c) => {
      const { message, recipient, sender } = await c.req.json();
      try {
        const from = sender ? new AgentId(sender.type, sender.key) : null;
        const result = await this.deliver(fromWire(message), new AgentId(recipient.type, recipient.key), from);
        return c.json({ result: toWire(result) });
      } catch (e) {
        return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
      }
    });
    this.server = await listen(app, 0);
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  /** Register locally (keep the factory) and advertise the type to the host. */
  async register(type: string, factory: Parameters<BaseAgentRuntime["register"]>[1]) {
    await super.register(type, factory);
    await post(`${toUrl(this.hostAddress)}/register`, { type, url: this.url });
    return type;
  }

  /** Always via the host, even if the recipient happens to live in this same worker. */
  async sendMessage<R = any>(message: object, recipient: AgentId, sender: AgentId | null = null): Promise<R> {
    const json = await post(`${toUrl(this.hostAddress)}/send`, { message: toWire(message), recipient, sender });
    return fromWire(json.result) as R;
  }

  async stop() {
    this.server?.closeAllConnections();
    this.server?.close();
  }
}
