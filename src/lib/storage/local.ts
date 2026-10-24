import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { imageSize } from "image-size";
import type { ImageStorage } from "./types";

/**
 * Development fallback when Cloudinary isn't configured: files go to `.uploads/` in the project
 * and are served by the /uploads/[...path] route. Not for production: serverless disks are
 * read-only or wiped between requests.
 */

export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), ".uploads");
const PREFIX = "local:";

const EXTENSIONS: Record<string, string> = { jpg: "jpg", png: "png", webp: "webp" };

/** Resolves a path inside the upload dir, refusing anything that escapes it. */
export function resolveLocalUpload(relativePath: string): string | null {
  const full = path.resolve(LOCAL_UPLOAD_DIR, relativePath);
  return full.startsWith(LOCAL_UPLOAD_DIR + path.sep) ? full : null;
}

export function createLocalStorage(): ImageStorage {
  return {
    name: "local",

    async upload(data, { folder }) {
      const { width, height, type } = imageSize(data);
      const ext = type ? EXTENSIONS[type] : undefined;
      if (!width || !height || !ext) throw new Error("Unsupported image.");

      const relative = path.posix.join(folder, `${randomUUID()}.${ext}`);
      const full = resolveLocalUpload(relative);
      if (!full) throw new Error("Invalid upload folder.");

      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, data);
      return { publicId: `${PREFIX}${relative}`, url: `/uploads/${relative}`, width, height };
    },

    async remove(publicId) {
      if (!publicId.startsWith(PREFIX)) return;
      const full = resolveLocalUpload(publicId.slice(PREFIX.length));
      if (full) await rm(full, { force: true });
    },
  };
}

export async function readLocalUpload(relativePath: string) {
  const full = resolveLocalUpload(relativePath);
  if (!full) return null;
  try {
    return await readFile(full);
  } catch {
    return null;
  }
}
