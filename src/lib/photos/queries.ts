import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { photos } from "@/db/schema";

/** What the client needs to show a photo. Storage ids stay on the server. */
export type PhotoView = {
  id: string;
  url: string;
  width: number;
  height: number;
  isCover: boolean;
};

const viewColumns = {
  id: photos.id,
  url: photos.url,
  width: photos.width,
  height: photos.height,
  isCover: photos.isCover,
};

export async function listPhotos(propertyId: string): Promise<PhotoView[]> {
  return db
    .select(viewColumns)
    .from(photos)
    .where(eq(photos.propertyId, propertyId))
    .orderBy(asc(photos.position), asc(photos.createdAt));
}

/** Storage ids of every photo of a listing, for cleaning up after the listing is deleted. */
export async function listPhotoStorageIds(propertyId: string) {
  const rows = await db
    .select({ publicId: photos.publicId })
    .from(photos)
    .where(eq(photos.propertyId, propertyId));
  return rows.map((r) => r.publicId);
}

export function photoFolder(propertyId: string) {
  return `casacast/properties/${propertyId}`;
}
