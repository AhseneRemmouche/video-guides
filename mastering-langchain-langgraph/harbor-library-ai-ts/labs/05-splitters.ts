// Lab 05: split documents into chunks that fit a prompt and still make sense alone.
import path from "node:path";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { loadPolicies } from "../src/knowledge.js";

const docs = await loadPolicies();

// 1. The general-purpose splitter: tries "\n\n", then "\n", then " ", then characters.
const plain = new RecursiveCharacterTextSplitter({ chunkSize: 200, chunkOverlap: 40 });
let chunks = await plain.splitDocuments(docs);
const sizes = chunks.map((c) => c.pageContent.length);
console.log(`1) Recursive, size 200 / overlap 40: ${chunks.length} chunks, ${Math.min(...sizes)}-${Math.max(...sizes)} characters`);
const fees = chunks.filter((c) => path.basename(c.metadata.source) === "fees.md");
for (const c of fees.slice(0, 3)) console.log(`   ${JSON.stringify(c.pageContent.slice(0, 90))}`);

// 2. Bigger chunks, and separators that prefer to cut at a "## " heading (what src/knowledge.ts uses).
const smart = new RecursiveCharacterTextSplitter({
  chunkSize: 400, chunkOverlap: 60, separators: ["\n## ", "\n\n", "\n", ". ", " ", ""],
});
chunks = await smart.splitDocuments(docs);
console.log(`\n2) Recursive, size 400, heading-first: ${chunks.length} chunks`);
console.log("   example:", JSON.stringify(chunks[3].pageContent.slice(0, 120)));

// 3. Split on Markdown headings and keep the headings as metadata. LangChain.js has no
//    MarkdownHeaderTextSplitter, so here is a small one: a new section starts at every "# " or "## " line.
function splitOnHeadings(text: string) {
  const sections: { metadata: Record<string, string>; pageContent: string }[] = [];
  const current: Record<string, string> = {};
  let lines: string[] = [];
  const flush = () => {
    if (lines.join("").trim()) sections.push({ metadata: { ...current }, pageContent: lines.join("\n").trim() });
    lines = [];
  };
  for (const line of text.split("\n")) {
    const heading = line.match(/^(#{1,2}) (.*)/);
    if (!heading) { lines.push(line); continue; }
    flush();
    if (heading[1] === "#") { current.page = heading[2].trim(); delete current.section; }
    else current.section = heading[2].trim();
  }
  flush();
  return sections;
}
const sections = docs.flatMap((d) => splitOnHeadings(d.pageContent));
console.log(`\n3) Split on headings: ${sections.length} sections`);
for (const s of sections.slice(0, 3)) console.log(`   ${JSON.stringify(s.metadata)}  ${JSON.stringify(s.pageContent.slice(0, 60))}`);
