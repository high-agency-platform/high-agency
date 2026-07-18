import { COHORT_ICON_PX, COHORT_ICON_MAX_CHARS } from "./types";

/** Turn a user-picked image file into a small square icon, encoded as a
 *  compressed data: URL small enough to store inline on a Firestore doc.
 *
 *  Center-crops to a square, downscales to COHORT_ICON_PX, prefers WebP and
 *  steps quality down until the result fits COHORT_ICON_MAX_CHARS. Client-only
 *  (uses <canvas>). Throws a human-readable Error the caller can surface. */
export async function fileToSquareIcon(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("That's not an image file.");
  }

  const source = await loadImage(file);
  const size = COHORT_ICON_PX;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process that image.");

  // Cover-crop: draw the largest centered square of the source into the canvas.
  const sw = "width" in source ? source.width : 0;
  const sh = "height" in source ? source.height : 0;
  const side = Math.min(sw, sh);
  if (!side) throw new Error("That image looks empty.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, (sw - side) / 2, (sh - side) / 2, side, side, 0, 0, size, size);
  if ("close" in source && typeof source.close === "function") source.close();

  // Prefer WebP (smaller); fall back to JPEG where WebP encode is unsupported.
  // Step quality down until we're under the inline-storage cap.
  for (const type of ["image/webp", "image/jpeg"]) {
    for (const q of [0.82, 0.7, 0.6, 0.5]) {
      const url = canvas.toDataURL(type, q);
      if (url.startsWith(`data:${type}`) && url.length <= COHORT_ICON_MAX_CHARS) {
        return url;
      }
    }
  }
  throw new Error("Couldn't shrink that image enough — try a simpler one.");
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the <img> path (e.g. formats createImageBitmap rejects).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = document.createElement("img");
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Couldn't read that image."));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
