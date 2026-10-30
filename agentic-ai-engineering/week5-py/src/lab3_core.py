"""
Week 5 - Lab 3: AutoGen Core -- the message-passing layer, run against Ollama.

Adapted from the course lab `3_lab3_autogen_core.py`. AutoGen Core is the lower
level beneath AgentChat: you define `@dataclass` messages, subclass
`RoutedAgent`, mark handlers with `@message_handler`, register agents on a
`SingleThreadedAgentRuntime`, and dispatch messages by `AgentId`.

The course's rock-paper-scissors example uses an OpenAI model for player 1 and
an Ollama model for player 2. Here EVERY agent uses local Ollama (llama3.2) so
the whole thing runs free and offline.

Two parts:
  1. A trivial `SimpleAgent` that just disagrees with you -- shows the
     register / start / send_message / stop lifecycle with no LLM involved.
  2. Rock-paper-scissors: a referee agent (`RockPaperScissorsAgent`) sends a
     prompt to two player agents, collects their one-word choices, then asks an
     LLM to judge the winner. Agents talking to agents over the runtime.

NOTE (honest): llama3.2 is a small model. Told to "respond with one word", it
often adds extra words anyway, so the players' choices and the judge's verdict
can be messy. The run captures whatever the models actually said.
"""

import _ssl_localhost_patch  # noqa: F401  (must be first; local-OpenSSL workaround -- see module docstring)

import asyncio
from dataclasses import dataclass

from autogen_core import (
    AgentId,
    MessageContext,
    RoutedAgent,
    SingleThreadedAgentRuntime,
    message_handler,
)
from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.messages import TextMessage
from autogen_ext.models.ollama import OllamaChatCompletionClient

MODEL = "llama3.2"


@dataclass
class Message:
    content: str


# ---- Part 1: a trivial routed agent, no LLM ------------------------------
class SimpleAgent(RoutedAgent):
    def __init__(self) -> None:
        super().__init__("Simple")

    @message_handler
    async def on_my_message(self, message: Message, ctx: MessageContext) -> Message:
        return Message(
            content=f"This is {self.id.type}-{self.id.key}. You said '{message.content}' and I disagree."
        )


# ---- Part 2: rock-paper-scissors over the runtime ------------------------
class PlayerAgent(RoutedAgent):
    """A player backed by a local Ollama model."""

    def __init__(self, name: str) -> None:
        super().__init__(name)
        model_client = OllamaChatCompletionClient(model=MODEL, temperature=1.0)
        self._delegate = AssistantAgent(name, model_client=model_client)

    @message_handler
    async def handle(self, message: Message, ctx: MessageContext) -> Message:
        text_message = TextMessage(content=message.content, source="user")
        response = await self._delegate.on_messages([text_message], ctx.cancellation_token)
        return Message(content=response.chat_message.content)


JUDGE = "You are judging a game of rock, paper, scissors. The players have made these choices:\n"


class RockPaperScissorsAgent(RoutedAgent):
    def __init__(self, name: str) -> None:
        super().__init__(name)
        model_client = OllamaChatCompletionClient(model=MODEL, temperature=1.0)
        self._delegate = AssistantAgent(name, model_client=model_client)

    @message_handler
    async def handle(self, message: Message, ctx: MessageContext) -> Message:
        instruction = (
            "You are playing rock, paper, scissors. Respond only with the one word, "
            "one of the following: rock, paper, or scissors."
        )
        prompt = Message(content=instruction)
        response1 = await self.send_message(prompt, AgentId("player1", "default"))
        response2 = await self.send_message(prompt, AgentId("player2", "default"))
        result = f"Player 1: {response1.content}\nPlayer 2: {response2.content}\n"
        judgement = f"{JUDGE}{result}Who wins?"
        verdict = await self._delegate.on_messages(
            [TextMessage(content=judgement, source="user")], ctx.cancellation_token
        )
        return Message(content=result + verdict.chat_message.content)


async def part1_simple() -> None:
    print("--- Part 1: SimpleAgent (no LLM) ---")
    runtime = SingleThreadedAgentRuntime()
    await SimpleAgent.register(runtime, "simple_agent", lambda: SimpleAgent())
    runtime.start()
    response = await runtime.send_message(
        Message("Well hi there!"), AgentId("simple_agent", "default")
    )
    print(">>>", response.content)
    await runtime.stop()
    await runtime.close()
    print()


async def part2_rps() -> None:
    print("--- Part 2: rock-paper-scissors (all Ollama) ---")
    runtime = SingleThreadedAgentRuntime()
    await PlayerAgent.register(runtime, "player1", lambda: PlayerAgent("player1"))
    await PlayerAgent.register(runtime, "player2", lambda: PlayerAgent("player2"))
    await RockPaperScissorsAgent.register(
        runtime, "rock_paper_scissors", lambda: RockPaperScissorsAgent("rock_paper_scissors")
    )
    runtime.start()
    response = await runtime.send_message(
        Message(content="go"), AgentId("rock_paper_scissors", "default")
    )
    print(response.content)
    await runtime.stop()
    await runtime.close()


async def main() -> None:
    print(f"== Using local Ollama model: {MODEL} ==\n")
    await part1_simple()
    await part2_rps()


if __name__ == "__main__":
    asyncio.run(main())
