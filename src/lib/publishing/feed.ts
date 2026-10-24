import "server-only";
import { and, eq, type SQL } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { channels, properties, publications } from "@/db/schema";
import { agencyOwned } from "@/demo/visibility";
import { LISTINGS_TAG } from "@/lib/catalog/queries";
import { siteUrl } from "@/lib/site-url";
import { buildKyeroFeed } from "./kyero";
import { loadSnapshot } from "./snapshot";

/**
 * The Kyero feed: active listings whose Kyero publication is `published`. Cached like the
 * catalogue and expired with it, whenever a listing or its publications change.
 */
export async function kyeroFeedXml(): Promise<string> {
  "use cache";
  cacheTag(LISTINGS_TAG);
  cacheLife("hours");

  // Demo version: sandboxes' listings never reach the public feed (see kyero-preview.xml).
  return kyeroFeedWhere(agencyOwned);
}

/** The feed for the listings matching `where`, among those whose Kyero publication is live. */
export async function kyeroFeedWhere(where: SQL): Promise<string> {
  const rows = await db
    .select({ propertyId: publications.propertyId })
    .from(publications)
    .innerJoin(channels, eq(channels.id, publications.channelId))
    .innerJoin(properties, eq(properties.id, publications.propertyId))
    .where(
      and(
        eq(channels.type, "kyero"),
        eq(channels.enabled, true),
        eq(publications.status, "published"),
        eq(properties.status, "active"),
        where,
      ),
    )
    .orderBy(properties.reference);

  const base = siteUrl();
  const listings = await Promise.all(rows.map((r) => loadSnapshot(r.propertyId, base)));
  return buildKyeroFeed(listings.filter((l) => l !== null));
}
