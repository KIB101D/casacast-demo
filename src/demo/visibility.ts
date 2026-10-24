import { eq, or, sql, type SQL } from "drizzle-orm";
import { properties, users, type UserRole } from "@/db/schema";

/**
 * Who sees what in the demo. Every visitor gets a sandbox (a demo user of their own), and what a
 * sandbox creates is visible to that sandbox only: never on the public site, in search engines or
 * in the Kyero feed, and never in another visitor's back office.
 */

/** Listings that belong to the agency, not to a demo sandbox: the only ones the public sees. */
export const agencyOwned: SQL = sql`exists (
  select 1 from ${users} owner
  where owner.id = ${properties.createdById} and owner.role <> 'demo'
)`;

/** Listings a back-office user may see: all for the admin; the agency's and their own for a sandbox. */
export function visibleTo(viewer: { id: string; role: UserRole }): SQL | undefined {
  if (viewer.role === "admin") return undefined;
  return or(eq(properties.createdById, viewer.id), agencyOwned);
}

/** The same rule for one listing already loaded. */
export function canViewListing(
  viewer: { id: string; role: UserRole },
  listing: { createdById: string; createdBy: { role: UserRole } },
) {
  return (
    viewer.role === "admin" ||
    listing.createdBy.role !== "demo" ||
    listing.createdById === viewer.id
  );
}
