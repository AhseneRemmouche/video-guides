// A small teaching runtime that mirrors the ideas of AutoGen Core. AutoGen has no JavaScript version, so this file
// is NOT a port of the library: it is about 100 lines that behave like the parts Lab 3 uses.
//
//   AutoGen Core (Python)                     this file (TypeScript)
//   @dataclass class Message                  class Message { constructor(public content: string) {} }  (in each lab)
//   class X(RoutedAgent)                      class X extends RoutedAgent
//   @message_handler + type hint "Message"    @messageHandler(Message)   (TypeScript types vanish at run time,
//                                                                          so the message class is passed explicitly)
//   MessageContext (sender, cancellation_token) MessageContext (sender, signal: AbortSignal)
//   AgentId(type, key)                        new AgentId(type, key)
//   SingleThreadedAgentRuntime                new SingleThreadedAgentRuntime()
//   await X.register(runtime, "x", lambda: X()) await X.register(runtime, "x", () => new X())
//   await runtime.send_message(msg, agent_id) await runtime.sendMessage(msg, agentId)
//   self.send_message(msg, agent_id)          this.sendMessage(msg, agentId)
//   runtime.start() / stop() / close()        runtime.start() / stop() / close()
//
// The fundamental principle is the same: the runtime handles creation and delivery; the agent only has logic.

export type MessageClass<M = any> = new (...args: any[]) => M;
type Handler = (message: any, ctx: MessageContext) => Promise<unknown>;

/** Every message class used by a handler, by name. The distributed runtime needs it to rebuild messages from JSON. */
export const messageTypes = new Map<string, MessageClass>();

/** The address of one agent: its type (the registered kind) plus a key (which instance). */
export class AgentId {
  constructor(readonly type: string, readonly key = "default") {}
  toString() {
    return `${this.type}/${this.key}`;
  }
}

/** Extra information delivered with each message. signal plays the part of AutoGen's CancellationToken. */
export interface MessageContext {
  sender: AgentId | null;
  signal: AbortSignal;
}

/** What an agent can ask of the runtime it lives in. Implemented here and by the worker in distributed.ts. */
export interface AgentRuntime {
  register(type: string, factory: () => RoutedAgent): Promise<string>;
  sendMessage<R = any>(message: object, recipient: AgentId, sender?: AgentId | null): Promise<R>;
}

/** Decorator: "this method receives messages of this class" (Python: @message_handler, routed by the type hint). */
export function messageHandler(type: MessageClass) {
  messageTypes.set(type.name, type);
  return (method: Handler, context: ClassMethodDecoratorContext) => {
    context.addInitializer(function (this: unknown) {
      (this as RoutedAgent).handlers.set(type, method.bind(this));
    });
  };
}

/** Base class for agents: routes each incoming message to the handler registered for its class. */
export abstract class RoutedAgent {
  readonly handlers = new Map<MessageClass, Handler>();
  id!: AgentId; // filled in by the runtime when it creates the instance
  runtime!: AgentRuntime;

  constructor(readonly description: string) {}

  /** Python: await SimpleAgent.register(runtime, "simple_agent", lambda: SimpleAgent()). Declares a type; creates nothing yet. */
  static async register<T extends RoutedAgent>(runtime: AgentRuntime, type: string, factory: () => T) {
    await runtime.register(type, factory);
    return { type }; // Python prints AgentType(type='simple_agent')
  }

  async onMessage(message: object, ctx: MessageContext): Promise<unknown> {
    const handler = this.handlers.get(message.constructor as MessageClass);
    if (!handler) throw new Error(`${this.id} has no handler for ${message.constructor.name}`);
    return handler(message, ctx);
  }

  /** Message another agent through the runtime, by address, never by holding a reference to it. */
  sendMessage<R = any>(message: object, recipient: AgentId): Promise<R> {
    return this.runtime.sendMessage<R>(message, recipient, this.id);
  }
}

/** The bookkeeping every runtime shares: factories by type, instances created lazily on the first message. */
export abstract class BaseAgentRuntime implements AgentRuntime {
  protected factories = new Map<string, () => RoutedAgent>();
  protected instances = new Map<string, RoutedAgent>();
  protected abort = new AbortController();

  async register(type: string, factory: () => RoutedAgent) {
    if (this.factories.has(type)) throw new Error(`Agent type ${type} is already registered`);
    this.factories.set(type, factory);
    return type;
  }

  abstract sendMessage<R = any>(message: object, recipient: AgentId, sender?: AgentId | null): Promise<R>;

  /** Find (or create, with the factory) the recipient and call its handler. */
  protected async deliver(message: object, recipient: AgentId, sender: AgentId | null): Promise<unknown> {
    let agent = this.instances.get(recipient.toString());
    if (!agent) {
      const factory = this.factories.get(recipient.type);
      if (!factory) throw new Error(`No agent type ${recipient.type} registered`);
      agent = factory();
      agent.id = recipient;
      agent.runtime = this;
      this.instances.set(recipient.toString(), agent);
    }
    return agent.onMessage(message, { sender, signal: this.abort.signal });
  }
}

/** The standalone runtime: everything in this one process. Messages wait in a queue until start() is called. */
export class SingleThreadedAgentRuntime extends BaseAgentRuntime {
  private running = false;
  private queue: (() => void)[] = [];

  sendMessage<R = any>(message: object, recipient: AgentId, sender: AgentId | null = null): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      const job = () => this.deliver(message, recipient, sender).then((r) => resolve(r as R), reject);
      if (this.running) job();
      else this.queue.push(job);
    });
  }

  start() {
    this.running = true;
    for (const job of this.queue.splice(0)) job();
  }

  async stop() {
    this.running = false; // new messages queue up again; ones already being handled finish
  }

  async close() {
    this.abort.abort(); // tell any handler still running that we are done
    this.instances.clear();
    this.factories.clear();
  }
}
