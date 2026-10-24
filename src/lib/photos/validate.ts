import { imageSize } from "image-size";
import { en, type AdminDictionary } from "@/i18n/admin/en";

/** The browser shrinks photos before upload, so anything near this size is suspicious. */
export const MAX_UPLOAD_BYTES = 2.5 * 1024 * 1024;
/** Listing photos smaller than this look blurry on a listing page. */
export const MIN_SHORT_SIDE = 400;

const ALLOWED_TYPES = new Set(["jpg", "png", "webp"]);

export type ImageCheck =
  { ok: true; width: number; height: number; type: string } | { ok: false; error: string };

/**
 * Checks the actual bytes, not the file name or the browser-reported MIME type,
 * both of which the client controls.
 */
export function checkImage(
  data: Uint8Array,
  t: AdminDictionary["photos"]["check"] = en.photos.check,
): ImageCheck {
  if (data.byteLength === 0) return { ok: false, error: t.empty };
  if (data.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, error: t.tooLarge };
  }

  let info: ReturnType<typeof imageSize>;
  try {
    info = imageSize(data);
  } catch {
    return { ok: false, error: t.unreadable };
  }

  const { width, height, type } = info;
  if (!type || !ALLOWED_TYPES.has(type) || !width || !height) {
    return { ok: false, error: t.unreadable };
  }
  if (Math.min(width, height) < MIN_SHORT_SIDE) {
    return {
      ok: false,
      error: t.tooSmall(width, height, MIN_SHORT_SIDE),
    };
  }
  return { ok: true, width, height, type };
}
