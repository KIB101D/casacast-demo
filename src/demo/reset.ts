import "server-only";
import { eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { leads, syncLogs, users } from "@/db/schema";
import { pruneRateLimits } from "./rate-limit";
import { deleteOrphanBlobs } from "./storage";

/**
 * The nightly reset: the demo starts every day as it was seeded.
 * - every enquiry goes (in the demo they are all test messages; their emails go with them);
 * - every sandbox goes, and with it (cascade) its listings, photos, translations, publications
 *   and sync logs;
 * - photo blobs left without a photo, and old rate-limit counters, are dropped.
 * The agency's listings are untouched; their sync log keeps a week.
 */
export async function resetDemo() {
  const removedLeads = await db.delete(leads).returning({ id: leads.id });
  const removedSandboxes = await db
    .delete(users)
    .where(eq(users.role, "demo"))
    .returning({ id: users.id });
  const removedBlobs = await deleteOrphanBlobs();
  await db.delete(syncLogs).where(lt(syncLogs.createdAt, sql`now() - interval '7 days'`));
  await pruneRateLimits();

  return {
    leads: removedLeads.length,
    sandboxes: removedSandboxes.length,
    photos: removedBlobs,
  };
}
