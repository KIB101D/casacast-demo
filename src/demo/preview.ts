import "server-only";
import { and, eq, or } from "drizzle-orm";
import { connection } from "next/server";
import { properties } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { getCurrentUser } from "@/lib/auth/dal";
import type { CatalogFilters } from "@/lib/catalog/filters";
import {
  catalogOrder,
  filterConditions,
  findListing,
  findListingCards,
  hasSitePageAnyOwner,
  onSiteAnyOwner,
  type ListingCard,
  type ListingDetail,
} from "@/lib/catalog/queries";

/**
 * A sandbox's own listings on the public site, for that sandbox only. The rules are the site's
 * (active, and published on the Website channel), so trying the demo shows what publishing does;
 * the pages are rendered per request, never cached, and carry `noindex`.
 */
async function sandboxOwner(): Promise<string | null> {
  // Request time only: the session check compares the token's expiry with the clock, which can't
  // run while Next.js prerenders the public page around this (e.g. the catalogue's static shell).
  await connection();
  const viewer = await getCurrentUser();
  return viewer?.role === "demo" ? viewer.id : null;
}

export async function getOwnListingPreview(
  reference: string,
  locale: Locale,
): Promise<ListingDetail | null> {
  const owner = await sandboxOwner();
  if (!owner) return null;
  return findListing(
    and(
      eq(properties.reference, reference),
      eq(properties.createdById, owner),
      // Same as the public page: active and on the site, or sold after having been on it.
      or(
        and(eq(properties.status, "active"), onSiteAnyOwner),
        and(eq(properties.status, "sold"), hasSitePageAnyOwner),
      ),
    ),
    locale,
  );
}

/** The visitor's own published demo listings that match the catalogue filters. */
export async function listOwnListingPreviews(
  filters: CatalogFilters,
  locale: Locale,
): Promise<ListingCard[]> {
  const owner = await sandboxOwner();
  if (!owner) return [];
  return findListingCards(
    and(
      eq(properties.createdById, owner),
      eq(properties.status, "active"),
      onSiteAnyOwner,
      ...filterConditions(filters),
    ),
    catalogOrder(filters),
    locale,
  );
}
