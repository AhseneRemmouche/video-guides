// Checks a photo sent by the browser before any model sees it.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export type Upload = { mimeType?: unknown; data?: unknown };

/** Returns { dataUrl } for a good photo, or { error } with a message the user can act on. */
export function checkUpload({ mimeType, data }: Upload): { dataUrl: string } | { error: string } {
  if (typeof mimeType !== "string" || !IMAGE_TYPES.includes(mimeType)) {
    return { error: `Please send a photo (PNG, JPEG, WebP or GIF), not "${String(mimeType || "unknown type")}".` };
  }
  if (typeof data !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    return { error: "The photo is missing or is not base64 text." };
  }
  const bytes = Math.floor((data.length * 3) / 4) - (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0);
  if (bytes > MAX_IMAGE_BYTES) {
    return { error: `The photo is ${(bytes / 1024 / 1024).toFixed(1)} MB; the limit is 5 MB.` };
  }
  return { dataUrl: `data:${mimeType};base64,${data}` };
}
