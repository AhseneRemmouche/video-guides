// Tests for the course graphs that run without an API key or internet: `pnpm test`.
// The model-based graphs get a fake chat model, so the tests check the graph wiring
// (nodes, edges, routing, tool calls, memory), not the wording of real model answers.
import { HumanMessage } from "langchain";
import { beforeEach, expect, test, vi } from "vitest";
import { FakeChatModel, type FakeOptions } from "./fake-model.js";

// Every course file calls getModel() from src/model.ts; here it returns the fake model instead.
const fake = vi.hoisted(() => ({ options: {} as FakeOptions }));
vi.mock("../src/model.js", () => ({ getModel: () => new FakeChatModel(fake.options) }));

beforeEach(() => vi.resetModules()); // import each course file fresh, with the options of its test

/** Import a course file from module1/ (name without .ts) with the fake model set up as asked. */
async function load(fileName: string, options: FakeOptions = {}) {
  fake.options = options;
  return import(`../module1/${fileName}.ts`);
}

test("string state appends greeting", async () => {
  const { graph } = await load("0-graph-state-str");
  expect(await graph.invoke({ text: "hey am new! " })).toEqual({ text: "hey am new! welcome to AI Career Lab!" });
});

test("typed state returns an object", async () => {
  const { graph } = await load("1-graph-state-dict");
  expect(await graph.invoke({ graph_str: "hello" })).toEqual({ graph_str: "hello welcome to AI Career Lab!" });
});

test.each([
  ["hello I am new", "Node 2"],
  ["hi I am new", "Node 3"],
  ["Hello I am new", "Node 3"], // the check is case-sensitive
])("conditional edge routes on the first word: %s", async (text, node) => {
  const { graph } = await load("2-graph-conditional-edge");
  expect((await graph.invoke({ graph_str: text })).graph_str).toMatch(new RegExp(`I am in ${node}$`));
});

test.each([
  ["2", "passed by node 2", 2],
  ["3", "passed by node 3", 3],
  ["1", "passed by node 1", 1],
  ["Two", "passed by node 1", 0], // Number("Two") is NaN: the graph turns it into 0
])("the model's number picks the route: %s", async (reply, expectedEnd, number) => {
  const { graph } = await load("3-graph-introduction-model", { reply });
  const result = await graph.invoke({ graph_str: "" });
  expect(result.graph_str.endsWith(expectedEnd)).toBe(true);
  expect(result.graph_int).toBe(number);
});

test("messages state appends the reply", async () => {
  const { graph } = await load("4-graph-messages-state", { reply: "Because of Rayleigh scattering." });
  const { messages } = await graph.invoke({ messages: [new HumanMessage("Why is the sky blue?")] });
  expect(messages.map((m: HumanMessage) => m.type)).toEqual(["human", "ai"]);
});

test("agent loops through the tool", async () => {
  const { graph } = await load("8-graph-agent", { toolCall: { name: "multiply", args: { nb1: 12, nb2: 7 } } });
  const { messages } = await graph.invoke({ messages: [new HumanMessage("What is 12 multiplied by 7?")] });
  expect(messages.map((m: HumanMessage) => m.type)).toEqual(["human", "ai", "tool", "ai"]);
  expect(messages[2].content).toBe("84");
});

test("division by zero becomes a tool message", async () => {
  const { graph } = await load("10-graph-division-tool", { toolCall: { name: "division", args: { nb1: 5, nb2: 0 } } });
  const { messages } = await graph.invoke({ messages: [new HumanMessage("Divide 5 by 0")] });
  expect(messages[2].type).toBe("tool");
  expect(messages[2].content).toContain("Cannot divide by zero");
});

test("memory keeps threads apart", async () => {
  const { graph } = await load("9-graph-agent-memory");
  const first = { configurable: { thread_id: "a" } };
  await graph.invoke({ messages: [new HumanMessage("My name is Luca")] }, first);
  await graph.invoke({ messages: [new HumanMessage("What is my name?")] }, first);
  const other = await graph.invoke({ messages: [new HumanMessage("What is my name?")] }, { configurable: { thread_id: "b" } });
  expect((await graph.getState(first)).values.messages).toHaveLength(4);
  expect(other.messages).toHaveLength(2);
});
