import "server-only";
import { and, count, desc, eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/db";
import {
  properties,
  publications,
  type Locale,
  type PropertyStatus,
  type UserRole,
} from "@/db/schema";
import { visibleTo } from "@/demo/visibility";

type Viewer = { id: string; role: UserRole };

const TITLE_PREFERENCE: Locale[] = ["en", "es", "uk"];

/** Picks the title in the admin's language, falling back through the others. */
function pickTitle(translations: { locale: Locale; title: string }[]) {
  for (const locale of TITLE_PREFERENCE) {
    const match = translations.find((t) => t.locale === locale);
    if (match) return match.title;
  }
  return "Untitled";
}

/** Demo version: a sandbox sees the agency's listings and its own, not other visitors'. */
export async function listProperties(viewer: Viewer) {
  const rows = await db.query.properties.findMany({
    where: visibleTo(viewer),
    orderBy: [desc(properties.updatedAt)],
    columns: {
      id: true,
      reference: true,
      type: true,
      operation: true,
      status: true,
      price: true,
      town: true,
      createdById: true,
      updatedAt: true,
    },
    with: {
      translations: { columns: { locale: true, title: true } },
      photos: {
        columns: { url: true },
        where: (photo, { eq }) => eq(photo.isCover, true),
        limit: 1,
      },
    },
  });

  return rows.map(({ translations, photos, ...row }) => ({
    ...row,
    title: pickTitle(translations),
    coverUrl: photos[0]?.url ?? null,
  }));
}

export type PropertyListItem = Awaited<ReturnType<typeof listProperties>>[number];

/** A listing with all its translations, or null for an unknown or malformed id. */
export async function getProperty(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const property = await db.query.properties.findFirst({
    where: eq(properties.id, id),
    with: { translations: true, createdBy: { columns: { role: true } } },
  });
  return property ?? null;
}

export type PropertyWithTranslations = NonNullable<Awaited<ReturnType<typeof getProperty>>>;

export async function countPropertiesCreatedBy(userId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(properties)
    .where(eq(properties.createdById, userId));
  return row?.value ?? 0;
}

export async function getDashboardCounts(viewer: Viewer) {
  const byStatus = await db
    .select({ status: properties.status, value: count() })
    .from(properties)
    .where(visibleTo(viewer))
    .groupBy(properties.status);

  const [failedSyncs] = await db
    .select({ value: count() })
    .from(publications)
    .innerJoin(properties, eq(properties.id, publications.propertyId))
    .where(and(eq(publications.status, "failed"), visibleTo(viewer)));

  const statusCounts = Object.fromEntries(byStatus.map((r) => [r.status, r.value])) as Partial<
    Record<PropertyStatus, number>
  >;

  return {
    active: statusCounts.active ?? 0,
    draft: statusCounts.draft ?? 0,
    sold: statusCounts.sold ?? 0,
    failedSyncs: failedSyncs?.value ?? 0,
  };
}
