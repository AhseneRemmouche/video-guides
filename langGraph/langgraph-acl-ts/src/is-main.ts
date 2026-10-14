// The TypeScript twin of Python's `if __name__ == "__main__":`.
// isMain(import.meta.url) is true when this file was started directly (`pnpm graph 9`, `tsx file.ts`),
// and false when another file, a test or the dev server imports it.
import { pathToFileURL } from "node:url";

export function isMain(moduleUrl: string) {
  return process.argv[1] !== undefined && moduleUrl === pathToFileURL(process.argv[1]).href;
}
