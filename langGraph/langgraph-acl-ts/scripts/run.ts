// Run a course file by its number or name:
//   pnpm graph 8                          runs module1/8-graph-agent.ts
//   pnpm graph 11 my-thread               extra words are passed on to the file
//   pnpm lesson 6-graph-tool-call-mistake runs lessons/6-graph-tool-call-mistake.ts
// The file runs as its own program (like `tsx module1/8-graph-agent.ts`), so its isMain() check is true.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const [kind, name = "", ...rest] = process.argv.slice(2);
const folder = path.resolve(import.meta.dirname, "..", kind === "lesson" ? "lessons" : "module1");
const files = readdirSync(folder).filter((f) => f.endsWith(".ts")).sort((a, b) => parseInt(a) - parseInt(b));
// a number ("8" finds "8-graph-agent.ts") or a whole file name without ".ts"
const found = files.filter((f) => f.startsWith(`${name}-`) || f === `${name}.ts`);

if (found.length !== 1) {
  console.error(`Pick one file in ${path.basename(folder)}/ (you gave "${name}"):\n  ${files.join("\n  ")}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--import", "tsx", path.join(folder, found[0]), ...rest], { stdio: "inherit" });
process.exit(result.status ?? 1);
