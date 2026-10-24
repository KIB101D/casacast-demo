import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { properties, type Locale } from "@/db/schema";
import { LOCALES } from "@/i18n/config";
import { listingSlug } from "@/lib/catalog/slug";
import type { ListingSnapshot } from "./types";

/** Loads a listing as channels see it, or null if it was deleted meanwhile. */
export async function loadSnapshot(
  propertyId: string,
  siteUrl: URL,
): Promise<ListingSnapshot | null> {
  const row = await db.query.properties.findFirst({
    where: eq(properties.id, propertyId),
    with: {
      translations: { columns: { locale: true, title: true, description: true } },
      photos: {
        columns: { url: true, isCover: true },
        orderBy: (photo, { asc }) => [asc(photo.position), asc(photo.createdAt)],
      },
      createdBy: { columns: { role: true } },
    },
  });
  if (!row) return null;

  const latin =
    row.translations.find((t) => t.locale === "en") ??
    row.translations.find((t) => t.locale === "es");
  const slug = listingSlug(row.reference, latin?.title ?? "");
  const pageUrls = Object.fromEntries(
    LOCALES.map((locale) => [locale, new URL(`/${locale}/homes/${slug}`, siteUrl).toString()]),
  ) as Record<Locale, string>;

  // Cover first, then the agent's order. Local development files get the site's origin.
  const ordered = [...row.photos.filter((p) => p.isCover), ...row.photos.filter((p) => !p.isCover)];

  return {
    id: row.id,
    reference: row.reference,
    type: row.type,
    operation: row.operation,
    status: row.status,
    price: row.price,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    area: row.area,
    plotArea: row.plotArea,
    town: row.town,
    province: row.province,
    latitude: row.latitude,
    longitude: row.longitude,
    translations: row.translations,
    photos: ordered.map((p) => new URL(p.url, siteUrl).toString()),
    pageUrls,
    updatedAt: row.updatedAt,
    ownerRole: row.createdBy.role,
  };
}
