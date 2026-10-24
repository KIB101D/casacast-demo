"use server";

import { refresh, updateTag } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { LISTINGS_TAG } from "@/lib/catalog/queries";
import { drainQueue } from "@/lib/publishing/queue";

/** Runs every due sync now, for all listings. The same work the cron job does. */
export async function runQueueNow() {
  await requireUser();
  const touched = await drainQueue({ budgetMs: 25_000 });
  if (touched.has("site") || touched.has("kyero")) updateTag(LISTINGS_TAG);
  refresh();
}
