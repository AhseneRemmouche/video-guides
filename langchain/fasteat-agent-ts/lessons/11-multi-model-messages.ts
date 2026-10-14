import "dotenv/config";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { createAgent, HumanMessage } from "langchain";
import { getVisionModel } from "../src/models.js";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/** Ask for an image path in the terminal (Node has no built-in file picker). */
async function chooseImageFile(): Promise<string> {
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

function imageToDataUrl(imagePath: string): string {
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

function buildImageMessage(imagePath: string): HumanMessage {
  return new HumanMessage({
    content: [
      { type: "text", text: "tell me what is the image about" },
      { type: "image_url", image_url: { url: imageToDataUrl(imagePath) } },
    ],
  });
}

const agent = createAgent({ model: getVisionModel() });
// `pnpm lesson 11 data/fridge.png` passes the path; without it we ask for one.
const imagePath = process.argv[2] ?? (await chooseImageFile());
const message = buildImageMessage(imagePath);

const response = await agent.invoke({
  messages: [message],
});

console.log(response.messages.at(-1)?.text);
