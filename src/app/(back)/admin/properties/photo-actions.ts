"use server";

import { and, eq, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { syncListing } from "@/lib/publishing/queue";
import * as z from "zod";
import { db } from "@/db";
import { LISTINGS_TAG } from "@/lib/catalog/queries";
import { photos, properties } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { assertWithinLimits, canModifyProperty, LimitError } from "@/lib/permissions";
import { coverAfterDelete, isSameSet } from "@/lib/photos/order";
import { listPhotos, photoFolder, type PhotoView } from "@/lib/photos/queries";
import { checkImage } from "@/lib/photos/validate";
import { getProperty } from "@/lib/properties/queries";
import { DEMO_LIMITS } from "@/demo/config";
import { hit, WINDOWS } from "@/demo/rate-limit";
import { removeStoredPhoto, storageFor } from "@/demo/storage";
import { getAdminI18n } from "@/i18n/admin/server";

/**
 * Every action returns the listing's photos as they are after the change,
 * so the client can replace its state instead of guessing what the server did.
 */
export type PhotoActionResult =
  { ok: true; photos: PhotoView[] } | { ok: false; error: string; photos?: PhotoView[] };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function authorize(
  propertyId: string,
): Promise<
  { ok: true; user: Awaited<ReturnType<typeof requireUser>> } | { ok: false; error: string }
> {
  const [user, { t }] = await Promise.all([requireUser(), getAdminI18n()]);
  const property = await getProperty(propertyId);
  if (!property) return { ok: false, error: t.editor.listingGone };
  if (!canModifyProperty(user, property)) return { ok: false, error: t.editor.demoCantPhotos };
  return { ok: true, user };
}

/**
 * Locks the listing row for the rest of the transaction. Photo changes on one listing then run
 * one after another, so two uploads at once can't both become the cover or take the same position.
 */
async function lockProperty(tx: Tx, propertyId: string) {
  await tx.execute(
    sql`select 1 from ${properties} where ${properties.id} = ${propertyId} for update`,
  );
}

export async function uploadPhoto(
  propertyId: string,
  formData: FormData,
): Promise<PhotoActionResult> {
  const auth = await authorize(propertyId);
  if (!auth.ok) return { ok: false, error: auth.error };
  const { t } = await getAdminI18n();

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: t.photos.noFile };

  const existing = await listPhotos(propertyId);
  try {
    assertWithinLimits(auth.user.role, "photosPerProperty", existing.length);
  } catch (error) {
    if (error instanceof LimitError)
      return { ok: false, error: t.limits[error.action](error.limit), photos: existing };
    throw error;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkImage(bytes, t.photos.check);
  if (!check.ok) return { ok: false, error: check.error, photos: existing };

  // Demo version: sandbox photos go to the database, and all sandboxes share a daily cap.
  if (
    auth.user.role === "demo" &&
    !(await hit("demo:photos", DEMO_LIMITS.photosPerDay, WINDOWS.day))
  ) {
    return { ok: false, error: t.photos.demoDailyLimit, photos: existing };
  }
  const storage = storageFor(auth.user.role);
  let stored;
  try {
    stored = await storage.upload(Buffer.from(bytes), { folder: photoFolder(propertyId) });
  } catch (error) {
    console.error("Photo upload failed", error);
    return { ok: false, error: t.photos.uploadFailed, photos: existing };
  }

  try {
    await db.transaction(async (tx) => {
      await lockProperty(tx, propertyId);
      const [stats] = await tx
        .select({
          count: sql<number>`count(*)::int`,
          maxPosition: sql<number>`coalesce(max(${photos.position}), -1)::int`,
        })
        .from(photos)
        .where(eq(photos.propertyId, propertyId));

      // Re-check inside the lock: another tab may have uploaded in the meantime.
      assertWithinLimits(auth.user.role, "photosPerProperty", stats!.count);

      await tx.insert(photos).values({
        propertyId,
        publicId: stored.publicId,
        url: stored.url,
        width: stored.width,
        height: stored.height,
        position: stats!.maxPosition + 1,
        isCover: stats!.count === 0,
      });
    });
  } catch (error) {
    // The file is stored but not recorded: remove it so it doesn't linger unused.
    await storage.remove(stored.publicId).catch(() => {});
    if (error instanceof LimitError) {
      return {
        ok: false,
        error: t.limits[error.action](error.limit),
        photos: await listPhotos(propertyId),
      };
    }
    throw error;
  }

  await photosChanged(propertyId);
  updateTag(LISTINGS_TAG);
  return { ok: true, photos: await listPhotos(propertyId) };
}

export async function deletePhoto(propertyId: string, photoId: string): Promise<PhotoActionResult> {
  const auth = await authorize(propertyId);
  if (!auth.ok) return { ok: false, error: auth.error };
  const { t } = await getAdminI18n();
  if (!z.uuid().safeParse(photoId).success) return { ok: false, error: t.photos.unknown };

  const removed = await db.transaction(async (tx) => {
    await lockProperty(tx, propertyId);
    const current = await tx
      .select({ id: photos.id, isCover: photos.isCover, publicId: photos.publicId })
      .from(photos)
      .where(eq(photos.propertyId, propertyId))
      .orderBy(photos.position);

    const target = current.find((p) => p.id === photoId);
    if (!target) return null;

    await tx.delete(photos).where(eq(photos.id, photoId));
    const nextCover = coverAfterDelete(current, photoId);
    if (target.isCover && nextCover) {
      await tx.update(photos).set({ isCover: true }).where(eq(photos.id, nextCover));
    }
    return target;
  });

  if (!removed) {
    return {
      ok: false,
      error: t.photos.alreadyDeleted,
      photos: await listPhotos(propertyId),
    };
  }

  // The database is the source of truth; a leftover file in storage is harmless, so don't fail on it.
  await removeStoredPhoto(removed.publicId).catch((error) =>
    console.error("Could not delete photo from storage", error),
  );

  await photosChanged(propertyId);
  updateTag(LISTINGS_TAG);
  return { ok: true, photos: await listPhotos(propertyId) };
}

const OrderSchema = z.array(z.uuid()).max(100);

export async function reorderPhotos(
  propertyId: string,
  orderedIds: string[],
): Promise<PhotoActionResult> {
  const auth = await authorize(propertyId);
  if (!auth.ok) return { ok: false, error: auth.error };
  const { t } = await getAdminI18n();

  const parsed = OrderSchema.safeParse(orderedIds);
  if (!parsed.success) return { ok: false, error: t.photos.invalidOrder };

  const applied = await db.transaction(async (tx) => {
    await lockProperty(tx, propertyId);
    const current = await tx
      .select({ id: photos.id })
      .from(photos)
      .where(eq(photos.propertyId, propertyId));

    if (
      !isSameSet(
        current.map((p) => p.id),
        parsed.data,
      )
    )
      return false;

    for (const [position, id] of parsed.data.entries()) {
      await tx.update(photos).set({ position }).where(eq(photos.id, id));
    }
    return true;
  });

  if (!applied) {
    return {
      ok: false,
      error: t.photos.changedElsewhere,
      photos: await listPhotos(propertyId),
    };
  }
  await photosChanged(propertyId);
  updateTag(LISTINGS_TAG);
  return { ok: true, photos: await listPhotos(propertyId) };
}

export async function setCoverPhoto(
  propertyId: string,
  photoId: string,
): Promise<PhotoActionResult> {
  const auth = await authorize(propertyId);
  if (!auth.ok) return { ok: false, error: auth.error };
  const { t } = await getAdminI18n();
  if (!z.uuid().safeParse(photoId).success) return { ok: false, error: t.photos.unknown };

  const found = await db.transaction(async (tx) => {
    await lockProperty(tx, propertyId);
    const [target] = await tx
      .select({ id: photos.id })
      .from(photos)
      .where(and(eq(photos.id, photoId), eq(photos.propertyId, propertyId)));
    if (!target) return false;

    // Clear first: the unique index allows only one cover per listing at any moment.
    await tx
      .update(photos)
      .set({ isCover: false })
      .where(and(eq(photos.propertyId, propertyId), eq(photos.isCover, true)));
    await tx.update(photos).set({ isCover: true }).where(eq(photos.id, photoId));
    return true;
  });

  if (!found) {
    return { ok: false, error: t.photos.deleted, photos: await listPhotos(propertyId) };
  }
  await photosChanged(propertyId);
  updateTag(LISTINGS_TAG);
  return { ok: true, photos: await listPhotos(propertyId) };
}

/**
 * After any photo change. The listing's "last modified" moves, because portals only re-read a
 * listing whose Kyero <date> changed; then the feed re-checks it (it needs a photo). Telegram posts
 * keep their first photo, so remote channels aren't touched.
 */
async function photosChanged(propertyId: string) {
  await db.update(properties).set({ updatedAt: new Date() }).where(eq(properties.id, propertyId));
  await syncListing(propertyId, { photosOnly: true });
}
