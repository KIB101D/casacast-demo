/**
 * Browser-side photo preparation. Phone photos are often 5–10 MB; shrinking them before upload
 * keeps requests small (server actions accept ~3 MB) and uploads fast on mobile data.
 */

export const MAX_EDGE = 2000;

/** Scales width × height down so the longer side is at most `maxEdge`. Never scales up. */
export function fitWithin(width: number, height: number, maxEdge = MAX_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

export class UnreadableImageError extends Error {
  constructor() {
    super("This file can't be read as a photo. Use JPG, PNG or WebP.");
    this.name = "UnreadableImageError";
  }
}

/** The browser could decode the photo but not re-encode it (no canvas, out of memory). */
export class PhotoPrepareError extends Error {
  constructor() {
    super("Your browser couldn't prepare the photo.");
    this.name = "PhotoPrepareError";
  }
}

/** Decodes, rotates to the camera orientation, resizes and re-encodes (WebP, JPEG as fallback). */
export async function compressImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // E.g. HEIC in browsers that can't decode it.
    throw new UnreadableImageError();
  }

  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new PhotoPrepareError();
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Browsers that can't encode WebP silently return PNG, so check the type we actually got.
  const webp = await canvasToBlob(canvas, "image/webp", 0.82);
  if (webp && webp.type === "image/webp") return webp;

  const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.85);
  if (!jpeg) throw new PhotoPrepareError();
  return jpeg;
}
