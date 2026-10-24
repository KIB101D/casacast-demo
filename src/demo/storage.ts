import "server-only";
import { eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db";
import type { UserRole } from "@/db/schema";
import { getStorage, type ImageStorage } from "@/lib/storage";
import { demoPhotoBlobs } from "./schema";

const PREFIX = "demo:";
/** Photos shipped with the repo for the agency's seed listings (public/seed/…). */
const STATIC_PREFIX = "static:";

/**
 * Where demo visitors' photos go: our own database, never Cloudinary. They are re-encoded as JPEG
 * (which also strips metadata and anything that isn't an image, and suits Kyero, which reads only
 * JPG, PNG or GIF), served by /demo-photos/[file], seen only by their author, and deleted at night.
 */
export const demoPhotoStorage: ImageStorage = {
  name: "local",

  async upload(data) {
    const image = sharp(data, { failOn: "error" }).rotate();
    const { data: jpeg, info } = await image
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

    const [row] = await db
      .insert(demoPhotoBlobs)
      .values({ contentType: "image/jpeg", data: jpeg, size: jpeg.byteLength })
      .returning({ id: demoPhotoBlobs.id });

    return {
      publicId: `${PREFIX}${row!.id}`,
      url: `/demo-photos/${row!.id}.jpg`,
      width: info.width,
      height: info.height,
    };
  },

  async remove(publicId) {
    if (!publicId.startsWith(PREFIX)) return;
    await db.delete(demoPhotoBlobs).where(eq(demoPhotoBlobs.id, publicId.slice(PREFIX.length)));
  },
};

/** Storage for a new upload: the database for sandboxes, the product's storage for the agency. */
export function storageFor(role: UserRole): ImageStorage {
  return role === "demo" ? demoPhotoStorage : getStorage();
}

/** Deletes a stored photo wherever it lives. Seed photos ship with the repo and stay. */
export async function removeStoredPhoto(publicId: string) {
  if (publicId.startsWith(STATIC_PREFIX)) return;
  if (publicId.startsWith(PREFIX)) return demoPhotoStorage.remove(publicId);
  return getStorage().remove(publicId);
}

/** Blobs whose photo row is gone (listing deleted, or the nightly reset). */
export async function deleteOrphanBlobs() {
  const result = await db.execute(sql`
    delete from ${demoPhotoBlobs} b
    where not exists (select 1 from photos p where p.public_id = ${PREFIX} || b.id::text)
  `);
  return result.rowCount ?? 0;
}

export const SEED_PHOTO_PREFIX = STATIC_PREFIX;
