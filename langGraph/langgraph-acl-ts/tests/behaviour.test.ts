// Extra offline tests: the behaviours the guide describes for the TypeScript files.
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage, HumanMessage, tool, type BaseMessage } from "langchain";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { FakeChatModel, type FakeOptions } from "./fake-model.js";

const fake = vi.hoisted(() => ({ options: {} as FakeOptions }));
vi.mock("../src/model.js", () => ({ getModel: () => new FakeChatModel(fake.options) }));

beforeEach(() => vi.resetModules());

async function load(folder: "module1" | "lessons", fileName: string, options: FakeOptions = {}) {
  fake.options = options;
  return folder === "module1" ? import(`../module1/${fileName}.ts`) : import(`../lessons/${fileName}.ts`);
}

const types = (messages: BaseMessage[]) => messages.map((m) => m.type);
const ask = (text: string) => ({ messages: [new HumanMessage(text)] });
const multiply = { toolCall: { name: "multiply", args: { nb1: 4, nb2: 5 } } };

test("graph 5 asks for the tool but never runs it", async () => {
  const { graph } = await load("module1", "5-graph-model-tool", multiply);
  expect(types((await graph.invoke(ask("What is 4 multiplied by 5?"))).messages)).toEqual(["human", "ai"]);
});

test("graph 6 runs the tool once, then ends", async () => {
  const { graph } = await load("module1", "6-graph-tool-call", multiply);
  const { messages } = await graph.invoke(ask("What is 4 multiplied by 5?"));
  expect(types(messages)).toEqual(["human", "ai", "tool"]);
  expect(messages[2].content).toBe("20");
});

test("the by-hand tool node gives the same result as ToolNode", async () => {
  const { graph } = await load("lessons", "6-graph-tool-call-by-hand", multiply);
  const { messages } = await graph.invoke(ask("What is 4 multiplied by 5?"));
  expect(types(messages)).toEqual(["human", "ai", "tool"]);
  expect(messages[2].content).toBe("20");
});

test("our own messages state works like MessagesAnnotation", async () => {
  const { graph } = await load("lessons", "4-graph-messages-state-own-class", { reply: "Blue light scatters most." });
  expect(types((await graph.invoke(ask("Why is the sky blue?"))).messages)).toEqual(["human", "ai"]);
});

test("ToolNode's error message, and handleToolErrors: false crashes the run", async () => {
  const { graph } = await load("module1", "10-graph-division-tool", { toolCall: { name: "division", args: { nb1: 5, nb2: 0 } } });
  const { messages } = await graph.invoke(ask("Divide 5 by 0"));
  expect(messages[2].content).toBe("Error: Cannot divide by zero. Ask the user for a different divisor.\n Please fix your mistakes.");
  expect(messages[2].status).toBe("error");

  const broken = tool(() => { throw new Error("Cannot divide by zero."); },
    { name: "division", description: "always fails", schema: z.object({}) });
  const call = { messages: [new AIMessage({ content: "", tool_calls: [{ name: "division", args: {}, id: "c1" }] })] };
  expect(new ToolNode([broken]).handleToolErrors).toBe(true); // the default
  await expect(new ToolNode([broken], { handleToolErrors: false }).invoke(call)).rejects.toThrow("Cannot divide by zero.");
});

test("the mistakes from the video fail in TypeScript too", async () => {
  await expect(load("lessons", "0-graph-state-str-mistake")).rejects.toThrow("startKey is not iterable");
  await expect(load("lessons", "6-graph-tool-call-mistake")).rejects.toThrow("Node `tools` is not reachable.");
});

test("the graphs draw the expected shapes", async () => {
  const drawing = async (file: string) => (await (await load("module1", file)).graph.getGraphAsync()).drawMermaid();
  expect(await drawing("2-graph-conditional-edge")).toContain("node1 -.-> node2;");
  expect(await drawing("6-graph-tool-call")).toContain("tools --> __end__;");
  expect(await drawing("8-graph-agent")).toContain("tools --> chat_with_tools;");
});

test("streaming updates gives one chunk per node", async () => {
  const { graph } = await load("module1", "2-graph-conditional-edge");
  const chunks = [];
  for await (const chunk of await graph.stream({ graph_str: "hello I am new " }, { streamMode: "updates" })) chunks.push(chunk);
  expect(chunks).toEqual([
    { node1: { graph_str: "hello I am new welcome to AI Carrer Lab" } },
    { node2: { graph_str: "hello I am new welcome to AI Carrer LabI am in Node 2" } },
  ]);
});

const folder = mkdtempSync(path.join(tmpdir(), "lg-sqlite-"));
afterAll(() => rmSync(folder, { recursive: true, force: true }));

test("a SQLite checkpointer keeps the thread when a new saver opens the same file", async () => {
  const { builder } = await load("module1", "8-graph-agent", multiply);
  const file = path.join(folder, "checkpoints.sqlite");
  const config = { configurable: { thread_id: "student-1" } };

  const firstSaver = SqliteSaver.fromConnString(file);
  const first = builder.compile({ checkpointer: firstSaver });
  await first.invoke(ask("What is 4 multiplied by 5?"), config);
  expect((await first.getState(config)).values.messages).toHaveLength(4);
  firstSaver.db.close(); // like the program stopping

  const secondSaver = SqliteSaver.fromConnString(file); // like a new run of the program
  const second = builder.compile({ checkpointer: secondSaver });
  await second.invoke(ask("And 4 multiplied by 5 again?"), config);
  expect((await second.getState(config)).values.messages).toHaveLength(8);
  secondSaver.db.close();
});
