import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { HumanMessage } from "langchain";

export const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/** Ask for an image path in the terminal, when none was passed on the command line. */
export async function chooseImageFile(): Promise<string> {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await terminal.question("Image path: ");
  terminal.close();
  const filename = answer.trim().replace(/^["']|["']$/g, "");
  if (!filename) {
    console.error("No image selected.");
    process.exit(1);
  }
  return filename;
}

export function imageToDataUrl(imagePath: string): string {
  const fullPath = path.resolve(imagePath);

  if (!existsSync(fullPath) || !statSync(fullPath).isFile()) {
    throw new Error(`Image not found: ${fullPath}`);
  }

  const mimeType = MIME_TYPES[path.extname(fullPath).toLowerCase()];
  if (!mimeType) {
    throw new Error(`Not an image file: ${fullPath}`);
  }

  const imageB64 = readFileSync(fullPath).toString("base64");
  return `data:${mimeType};base64,${imageB64}`;
}

/** A message with text and a picture, already turned into a data URL. */
export function buildDataUrlMessage(dataUrl: string, prompt: string): HumanMessage {
  return new HumanMessage({
    content: [
      { type: "text", text: prompt }, // fixed: the variable prompt, not the text "prompt"
      { type: "image_url", image_url: { url: dataUrl } },
    ],
  });
}

export function buildImageMessage(imagePath: string, prompt: string): HumanMessage {
  return buildDataUrlMessage(imageToDataUrl(imagePath), prompt);
}
