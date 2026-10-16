import { Agent as LLMAgent } from "@openai/agents";
import { AssistantAgent } from "./core/assistant.js";
import { messageHandler, RoutedAgent, type MessageContext } from "./core/runtime.js";
import * as messages from "./messages.js";
import { MODEL } from "./setup.js";

export class Agent extends RoutedAgent {
  // Change this system message to reflect the unique characteristics of this agent

  systemMessage = `
    You are a creative entrepreneur. Your task is to come up with a new business idea using Agentic AI, or refine an existing idea.
    Your personal interests are in these sectors: Healthcare, Education.
    You are drawn to ideas that involve disruption.
    You are less interested in ideas that are purely automation.
    You are optimistic, adventurous and have risk appetite. You are imaginative - sometimes too much so.
    Your weaknesses: you're not patient, and can be impulsive.
    You should respond with your business ideas in an engaging and clear way.
    `;

  CHANCES_THAT_I_BOUNCE_IDEA_OFF_ANOTHER = 0.5;

  // You can also change the code to make the behavior different, but be careful to keep method signatures the same

  private delegate: AssistantAgent<string>;

  constructor(name: string) {
    super(name);
    const llm = new LLMAgent({ name, model: MODEL, modelSettings: { temperature: 0.7 }, instructions: this.systemMessage });
    this.delegate = new AssistantAgent(llm);
  }

  @messageHandler(messages.Message)
  async handleMessage(message: messages.Message, ctx: MessageContext): Promise<messages.Message> {
    console.log(`${this.id.type}: Received message`);
    let idea = await this.delegate.reply(message.content, ctx.signal);
    if (Math.random() < this.CHANCES_THAT_I_BOUNCE_IDEA_OFF_ANOTHER) {
      const recipient = messages.findRecipient();
      const text = `Here is my business idea. It may not be your speciality, but please refine it and make it better. ${idea}`;
      const response = await this.sendMessage<messages.Message>(new messages.Message(text), recipient);
      idea = response.content;
    }
    return new messages.Message(idea);
  }
}
