// The library's catalog and member records, and the tools an agent may call on them.
import { readFileSync } from "node:fs";
import path from "node:path";
import { tool } from "langchain";
import { z } from "zod";
import { DATA } from "./config.js";

export type Item = {
  id: string; title: string; author: string; year: string; format: string;
  genre: string; branch: string; copies: string; available: string;
};
export type Member = {
  name: string; card: string; fees_eur: number;
  loans: { id: string; due: string }[]; holds: string[];
};

// The CSV has no quoted fields, so splitting on commas is enough here.
const [header, ...rows] = readFileSync(path.join(DATA, "catalog.csv"), "utf-8").trim().split(/\r?\n/);
const columns = header.split(",");
export const CATALOG: Record<string, Item> = Object.fromEntries(
  rows.map((line) => {
    const item = Object.fromEntries(line.split(",").map((v, i) => [columns[i], v])) as Item;
    return [item.id, item];
  }),
);
export const MEMBERS: Record<string, Member> = JSON.parse(readFileSync(path.join(DATA, "members.json"), "utf-8"));

export function findItems(query: string): Item[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return Object.values(CATALOG).filter((b) =>
    words.some((w) => `${b.title} ${b.author} ${b.genre}`.toLowerCase().includes(w)));
}

export const searchCatalog = tool(
  ({ query }) => {
    const hits = findItems(query);
    if (!hits.length) return `No items match '${query}'.`;
    return hits.slice(0, 5).map((b) => `${b.id}: ${b.title} by ${b.author} (${b.format}, ${b.year})`).join("\n");
  },
  {
    name: "search_catalog",
    description: "Search the catalog by words in the title, author or genre. Returns matching items with their ids.",
    schema: z.object({ query: z.string() }),
  },
);

export const checkAvailability = tool(
  ({ item_id }) => {
    const b = CATALOG[item_id.trim().toUpperCase()];
    if (!b) return `There is no item ${item_id}.`;
    return `${b.title}: ${b.available} of ${b.copies} copies available at ${b.branch}.`;
  },
  {
    name: "check_availability",
    description: "Tell how many copies of an item (id like B004) are on the shelf, and at which branch.",
    schema: z.object({ item_id: z.string() }),
  },
);

export const getMemberAccount = tool(
  ({ member_id }) => {
    const m = MEMBERS[member_id.trim().toUpperCase()];
    if (!m) return `There is no member ${member_id}.`;
    const loans = m.loans.map((l) => `${CATALOG[l.id].title} (due ${l.due})`).join(", ") || "none";
    const holds = m.holds.length ? JSON.stringify(m.holds) : "none";
    return `${m.name} (${m.card} card). Loans: ${loans}. Holds: ${holds}. Fees: ${m.fees_eur.toFixed(2)} EUR.`;
  },
  {
    name: "get_member_account",
    description: "Show a member's loans with due dates, holds and unpaid fees. Member ids look like M-1001.",
    schema: z.object({ member_id: z.string() }),
  },
);

export const placeHold = tool(
  ({ member_id, item_id }) => {
    const m = MEMBERS[member_id.trim().toUpperCase()];
    const b = CATALOG[item_id.trim().toUpperCase()];
    if (!m || !b) return "Unknown member or item.";
    if (m.holds.length >= 5) return "This member already has 5 holds, the maximum.";
    m.holds.push(b.id); // in memory only: the labs never write the JSON file
    return `Hold placed on ${b.title} for ${m.name}. We keep it for 7 days once it is back.`;
  },
  {
    name: "place_hold",
    description: "Place a hold on an item for a member. This changes the member's account.",
    schema: z.object({ member_id: z.string(), item_id: z.string() }),
  },
);

export const READ_TOOLS = [searchCatalog, checkAvailability, getMemberAccount];
export const ALL_TOOLS = [...READ_TOOLS, placeHold];
