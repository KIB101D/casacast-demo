import "server-only";
import { and, asc, desc, eq, gte, lte, or, sql, type SQL } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import {
  channels,
  photos,
  properties,
  publications,
  users,
  type Locale,
  type PropertyType,
} from "@/db/schema";
import { agencyOwned } from "@/demo/visibility";
import type { CatalogFilters } from "./filters";
import { listingSlug } from "./slug";

/**
 * Public catalogue reads. Cached with `use cache` and tagged, so the site is served from cache
 * and the back office expires the tag (updateTag) whenever a listing or photo changes.
 */
export const LISTINGS_TAG = "listings";

/**
 * The site is a publishing channel like the others: the catalogue shows active listings whose
 * site publication is `published`. Unticking "Website" in the back office hides a listing here.
 */
export const onSiteAnyOwner = sql`exists (
  select 1 from ${publications} pub join ${channels} ch on ch.id = pub.channel_id
  where pub.property_id = ${properties.id} and ch.type = 'site' and pub.status = 'published'
)`;

// Demo version: the public only ever sees the agency's listings. A sandbox sees its own on the site
// through the preview in src/demo/preview.ts.
const onSite = sql`(${onSiteAnyOwner} and ${agencyOwned})`;

/** A sold listing keeps its page (with a "no longer available" note) if it was on the site. */
export const hasSitePageAnyOwner = sql`exists (
  select 1 from ${publications} pub join ${channels} ch on ch.id = pub.channel_id
  where pub.property_id = ${properties.id} and ch.type = 'site' and pub.external_id is not null
)`;
const hasSitePage = sql`(${hasSitePageAnyOwner} and ${agencyOwned})`;

type Translation = { locale: Locale; title: string; description: string };

/** The requested language, then Spanish (always present), then whatever exists. */
function pickTranslation<T extends { locale: Locale }>(
  translations: T[],
  locale: Locale,
): T | undefined {
  return (
    translations.find((t) => t.locale === locale) ??
    translations.find((t) => t.locale === "es") ??
    translations[0]
  );
}

/** The slug is built from the English or Spanish title, so Ukrainian pages still get readable URLs. */
function slugFor(
  reference: string,
  translations: Translation[] | { locale: Locale; title: string }[],
) {
  const latin =
    translations.find((t) => t.locale === "en") ?? translations.find((t) => t.locale === "es");
  return listingSlug(reference, latin?.title ?? "");
}

export type ListingCard = {
  reference: string;
  slug: string;
  type: PropertyType;
  operation: "sale" | "rent";
  price: number;
  bedrooms: number;
  bathrooms: number;
  area: number;
  town: string;
  title: string;
  cover: { url: string; width: number; height: number } | null;
};

export async function searchListings(
  filters: CatalogFilters,
  locale: Locale,
): Promise<ListingCard[]> {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("hours");

  return findListingCards(
    and(eq(properties.status, "active"), onSite, ...filterConditions(filters)),
    catalogOrder(filters),
    locale,
  );
}

/** The catalogue filters as SQL conditions (without the visibility rules). */
export function filterConditions(filters: CatalogFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.operation) conditions.push(eq(properties.operation, filters.operation));
  if (filters.type) conditions.push(eq(properties.type, filters.type));
  if (filters.town) conditions.push(sql`lower(${properties.town}) = lower(${filters.town})`);
  if (filters.maxPrice) conditions.push(lte(properties.price, filters.maxPrice));
  if (filters.minBedrooms) conditions.push(gte(properties.bedrooms, filters.minBedrooms));
  return conditions;
}

export function catalogOrder(filters: CatalogFilters): SQL[] {
  return filters.sort === "price-asc"
    ? [asc(properties.price)]
    : filters.sort === "price-desc"
      ? [desc(properties.price)]
      : [desc(properties.createdAt)];
}

/** Catalogue cards for any condition. Uncached: searchListings caches the public case. */
export async function findListingCards(
  where: SQL | undefined,
  orderBy: SQL[],
  locale: Locale,
): Promise<ListingCard[]> {
  const rows = await db.query.properties.findMany({
    where,
    orderBy,
    columns: {
      reference: true,
      type: true,
      operation: true,
      price: true,
      bedrooms: true,
      bathrooms: true,
      area: true,
      town: true,
    },
    with: {
      translations: { columns: { locale: true, title: true } },
      photos: {
        columns: { url: true, width: true, height: true },
        where: (photo, { eq }) => eq(photo.isCover, true),
        limit: 1,
      },
    },
  });

  return rows.map(({ translations, photos, ...row }) => ({
    ...row,
    title: pickTranslation(translations, locale)?.title ?? row.reference,
    slug: slugFor(row.reference, translations),
    cover: photos[0] ?? null,
  }));
}

export type ListingDetail = {
  id: string;
  reference: string;
  slug: string;
  type: PropertyType;
  operation: "sale" | "rent";
  status: "active" | "sold";
  price: number;
  bedrooms: number;
  bathrooms: number;
  area: number;
  plotArea: number | null;
  town: string;
  province: string;
  latitude: number | null;
  longitude: number | null;
  title: string;
  description: string;
  /** Language the text is actually in; differs from the page language when falling back. */
  textLocale: Locale;
  photos: { url: string; width: number; height: number }[];
  updatedAt: string;
};

export async function getListing(reference: string, locale: Locale): Promise<ListingDetail | null> {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("hours");

  return findListing(
    and(
      eq(properties.reference, reference),
      or(
        and(eq(properties.status, "active"), onSite),
        and(eq(properties.status, "sold"), hasSitePage),
      ),
    ),
    locale,
  );
}

/** One listing page's data for any condition. Uncached: getListing caches the public case. */
export async function findListing(
  where: SQL | undefined,
  locale: Locale,
): Promise<ListingDetail | null> {
  const row = await db.query.properties.findFirst({
    where,
    with: {
      translations: { columns: { locale: true, title: true, description: true } },
      photos: {
        columns: { url: true, width: true, height: true },
        orderBy: (photo, { asc }) => [asc(photo.position)],
      },
    },
  });
  if (!row || (row.status !== "active" && row.status !== "sold")) return null;

  const text = pickTranslation(row.translations, locale);
  return {
    id: row.id,
    reference: row.reference,
    slug: slugFor(row.reference, row.translations),
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
    title: text?.title ?? row.reference,
    description: text?.description ?? "",
    textLocale: text?.locale ?? "es",
    photos: row.photos,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Towns that currently have active listings, for the filter. */
export async function listTowns(): Promise<string[]> {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("hours");

  const rows = await db
    .selectDistinct({ town: properties.town })
    .from(properties)
    .where(and(eq(properties.status, "active"), onSite))
    .orderBy(asc(properties.town));
  return rows.map((r) => r.town);
}

export async function listForSitemap(): Promise<{ slug: string; updatedAt: string }[]> {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("hours");

  const rows = await db.query.properties.findMany({
    where: and(eq(properties.status, "active"), onSite),
    columns: { reference: true, updatedAt: true },
    with: { translations: { columns: { locale: true, title: true } } },
  });
  return rows.map((r) => ({
    slug: slugFor(r.reference, r.translations),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/** The banner photo: the most expensive active listing that has a cover photo. */
export async function getHeroListing(locale: Locale): Promise<ListingCard | null> {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("hours");

  const withCover = (await searchListings({ sort: "price-desc" }, locale)).filter((l) => l.cover);
  return withCover[0] ?? null;
}

export type TownStat = { town: string; count: number; coverUrl: string | null };

/** Towns with active listings: most listings first, then towns with a photo. Each gets its priciest home's cover. */
export async function listTownStats(): Promise<TownStat[]> {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("hours");

  const result = await db.execute<{ town: string; count: number; cover_url: string | null }>(sql`
    select * from (
      select p.town,
             count(*)::int as count,
             (select ph.url
                from ${photos} ph
                join ${properties} p2 on p2.id = ph.property_id
               where p2.town = p.town and p2.status = 'active' and ph.is_cover
                 and exists (select 1 from ${users} u2 where u2.id = p2.created_by_id and u2.role <> 'demo')
               order by p2.price desc
               limit 1) as cover_url
        from ${properties} p
       where p.status = 'active'
         and exists (select 1 from ${users} u where u.id = p.created_by_id and u.role <> 'demo')
         and exists (
           select 1 from ${publications} pub join ${channels} ch on ch.id = pub.channel_id
           where pub.property_id = p.id and ch.type = 'site' and pub.status = 'published'
         )
       group by p.town
    ) towns
    order by count desc, (cover_url is null) asc, town asc
  `);
  return result.rows.map((r) => ({ town: r.town, count: r.count, coverUrl: r.cover_url }));
}
