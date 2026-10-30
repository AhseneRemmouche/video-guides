// Representative DEMO content. This mirrors the shape of a Week 5 AutoGen
// AgentChat exchange (see week5-py/src/lab1_agentchat.py) but is hard-coded --
// there is NO AutoGen or model running behind this UI.

export type ToolCall = {
  name: string;
  args: Record<string, unknown>;
  result: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  source: string; // AutoGen `TextMessage.source`, e.g. "user" / agent name
  content: string;
  /** Tool calls the assistant made before answering (AgentChat inner events). */
  toolCalls?: ToolCall[];
};

export const AGENT_NAME = "smart_airline_agent";
export const MODEL = "llama3.2 (local Ollama)";

export const conversation: ChatMessage[] = [
  {
    id: "m1",
    role: "user",
    source: "user",
    content: "I'd like to go to London. How much is a round trip?",
  },
  {
    id: "m2",
    role: "assistant",
    source: AGENT_NAME,
    toolCalls: [
      {
        name: "get_city_price",
        args: { city_name: "London" },
        result: "299.0",
      },
    ],
    content:
      "That's a pretty penny for a pint of tea, but a round-trip ticket to " +
      "London will set you back about $299. Worth it for a spot of tea and a " +
      "dose of British charm!",
  },
  {
    id: "m3",
    role: "user",
    source: "user",
    content: "And Rome instead?",
  },
  {
    id: "m4",
    role: "assistant",
    source: AGENT_NAME,
    toolCalls: [
      {
        name: "get_city_price",
        args: { city_name: "Rome" },
        result: "499.0",
      },
    ],
    content:
      "Ah, Rome — $499 round trip. A bit more, but you get gelato, ruins and " +
      "a thousand reasons to say 'when in Rome'.",
  },
];
