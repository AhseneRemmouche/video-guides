// Run a lesson or the chef:
//   pnpm lesson 08                 runs lessons/08-tools.ts
//   pnpm lesson 10-before          runs lessons/10-in-memory-agent-before.ts
//   pnpm lesson 11 data/fridge.png runs lessons/11-multi-model-messages.ts with that image
//   pnpm chef data/fridge.png      runs chef/main.ts
//   pnpm chef chat-chef data/fridge.png   runs chef/chat-chef.ts (also structured-chef, main-any-model)
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const [kind, ...args] = process.argv.slice(2);

function lessonFile(name = ""): string | undefined {
  const [num, variant] = name.split("-");
  const prefix = `${num.padStart(2, "0")}-`;
  const files = readdirSync(path.join(ROOT, "lessons"));
  const file = files.find((f) => f.startsWith(prefix) && (variant ? f.endsWith(`-${variant}.ts`) : !f.endsWith("-before.ts")));
  return file && path.join(ROOT, "lessons", file);
}

let file: string | undefined;
let rest = args;
if (kind === "lesson") {
  file = lessonFile(args[0]);
  rest = args.slice(1);
  if (!file) {
    console.error(`No lesson ${args[0] ?? ""}. Usage: pnpm lesson 04  (04 to 11, or 10-before)`);
    process.exit(1);
  }
} else {
  const named = args[0] && path.join(ROOT, "chef", `${args[0]}.ts`);
  if (named && existsSync(named)) {
    file = named;
    rest = args.slice(1);
  } else {
    file = path.join(ROOT, "chef", "main.ts");
  }
}

// The script sees its own arguments only: process.argv[2] is the image path, if any.
process.argv = [process.argv[0], file, ...rest];
await import(pathToFileURL(file).href);
