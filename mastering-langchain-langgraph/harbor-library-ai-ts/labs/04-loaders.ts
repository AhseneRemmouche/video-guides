// Lab 04: load files into LangChain Documents (text + metadata).
import path from "node:path";
import { Document } from "@langchain/core/documents";
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { DirectoryLoader } from "@langchain/classic/document_loaders/fs/directory";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import { CATALOG } from "../src/catalog.js";
import { DATA } from "../src/config.js";

// 1. One file.
const [doc] = await new TextLoader(path.join(DATA, "policies", "loans.md")).load();
console.log("1) TextLoader:", doc.constructor.name, "| metadata:", { source: path.basename(doc.metadata.source) });
console.log("   first 80 characters:", JSON.stringify(doc.pageContent.slice(0, 80)));

// 2. A whole folder: one Document per file. The map says which loader handles which extension.
const policies = await new DirectoryLoader(path.join(DATA, "policies"), { ".md": (p) => new TextLoader(p) }).load();
console.log(`\n2) DirectoryLoader: ${policies.length} documents`);
for (const d of policies) {
  console.log(`   ${path.basename(d.metadata.source).padEnd(16)} ${String(d.pageContent.length).padStart(5)} characters`);
}

// 3. A CSV: one Document per row, every column as "name: value" text. Metadata holds the file and line.
const rows = await new CSVLoader(path.join(DATA, "catalog.csv")).load();
console.log(`\n3) CSVLoader: ${rows.length} documents (one per row)`);
console.log("   pageContent:", JSON.stringify(rows[0].pageContent.slice(0, 120)));
console.log("   metadata:   ", { ...rows[0].metadata, source: path.basename(rows[0].metadata.source) });

// 4. Metadata is what lets you filter later. The JS CSVLoader cannot copy columns into metadata,
//    so build the Documents yourself: the text to search goes in pageContent, the fields to filter on in metadata.
const books = Object.values(CATALOG).map((b) => new Document({
  pageContent: `${b.title} by ${b.author} (${b.genre}, ${b.year})`,
  metadata: { source: b.id, branch: b.branch, format: b.format, available: b.available },
}));
const available = books.filter((b) => b.metadata.available !== "0");
console.log(`\n4) ${available.length} of ${books.length} titles have a copy on the shelf`);
console.log("   example:", available[0].pageContent, available[0].metadata);
