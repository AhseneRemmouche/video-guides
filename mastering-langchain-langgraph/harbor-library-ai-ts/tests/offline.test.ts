// Tests that need no model: run them with `pnpm test`.
import { AIMessage, HumanMessage, trimMessages, type BaseMessage } from "@langchain/core/messages";
import { RunnableLambda } from "@langchain/core/runnables";
import { describe, expect, test } from "vitest";
import { MEMBERS, checkAvailability, getMemberAccount, placeHold, searchCatalog } from "../src/catalog.js";
import { formatDocs, loadPolicies, split } from "../src/knowledge.js";
import * as mcpServer from "../src/mcp-server.js";

describe("harbor offline", () => {
  test("policies load and split", async () => {
    const docs = await loadPolicies();
    expect(docs).toHaveLength(6);
    const chunks = await split(docs);
    expect(chunks.every((c) => c.pageContent.length <= 400)).toBe(true);
    expect(formatDocs(chunks.filter((c) => c.metadata.source.endsWith("fees.md")).slice(0, 1))).toContain("[fees.md]");
  });

  test("catalog tools", async () => {
    expect(await searchCatalog.invoke({ query: "Mara Quint" })).toContain("B001");
    expect(await checkAvailability.invoke({ item_id: "b010" })).toContain("0 of 4"); // ids are case-insensitive
    expect(await getMemberAccount.invoke({ member_id: "M-1003" })).toContain("16.00 EUR");
  });

  test("search needs the word inside the text", async () => {
    // The weakness lab 10 shows: "radios" does not occur inside "Radio", so nothing matches.
    expect(await searchCatalog.invoke({ query: "radios" })).toMatch(/^No items/);
    expect(await searchCatalog.invoke({ query: "radio" })).toContain("B011");
  });

  test("place_hold changes memory only", async () => {
    const before = [...MEMBERS["M-1001"].holds];
    expect(await placeHold.invoke({ member_id: "M-1001", item_id: "B003" })).toContain("Hold placed");
    MEMBERS["M-1001"].holds = before; // undo, the JSON file was never touched
  });

  test("MCP server functions", () => {
    expect(mcpServer.searchCatalog("radio")).toContain("B011");
    expect(mcpServer.genres()).toContain("music");
  });

  test("trim keeps recent turns", async () => {
    const history = [new HumanMessage("q1"), new AIMessage("a1"), new HumanMessage("q2"), new AIMessage("a2")];
    const approxTokens = (ms: BaseMessage[]) => ms.reduce((n, m) => n + Math.ceil(String(m.content).length / 4) + 3, 0);
    const kept = await trimMessages(history, { maxTokens: 8, tokenCounter: approxTokens, strategy: "last", startOn: "human" });
    expect(kept[0].content).toBe("q2");
  });

  test("runnable composition", async () => {
    const chain = RunnableLambda.from((s: string) => s.toUpperCase()).pipe(RunnableLambda.from((s: string) => s.length));
    expect(await chain.invoke("abc")).toBe(3);
    expect(await chain.batch(["a", "ab"])).toEqual([1, 2]);
  });
});
