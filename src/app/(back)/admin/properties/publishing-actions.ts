"use server";

import { and, eq } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { after } from "next/server";
import { db } from "@/db";
import { properties, publications } from "@/db/schema";
import { getAdminI18n } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/dal";
import { LISTINGS_TAG } from "@/lib/catalog/queries";
import { canModifyProperty } from "@/lib/permissions";
import { getProperty } from "@/lib/properties/queries";
import {
  drainQueue,
  retryPublication,
  setEnabledPublications,
  syncListing,
} from "@/lib/publishing/queue";
import { getPublishingPanel, type PublishingPanelData } from "@/lib/publishing/views";

export type PublishingActionResult =
  | { ok: true; panel: PublishingPanelData }
  | { ok: false; error: string; panel: PublishingPanelData };

async function authorize(propertyId: string) {
  const [user, { t }] = await Promise.all([requireUser(), getAdminI18n()]);
  const property = await getProperty(propertyId);
  if (!property) return { ok: false, error: t.editor.listingGone } as const;
  if (!canModifyProperty(user, property)) {
    return { ok: false, error: t.editor.demoCantPublish } as const;
  }
  return { ok: true, property } as const;
}

/** Runs the inline channels now and the remote ones after the response. */
async function runQueue(propertyId: string) {
  await drainQueue({ propertyId, inlineOnly: true, budgetMs: 5_000 });
  updateTag(LISTINGS_TAG);
  after(() => drainQueue({ propertyId }));
}

export async function saveChannels(
  propertyId: string,
  enabledPublicationIds: string[],
): Promise<PublishingActionResult> {
  const auth = await authorize(propertyId);
  if (!auth.ok) {
    return { ok: false, error: auth.error, panel: await getPublishingPanel(propertyId) };
  }
  await setEnabledPublications(propertyId, enabledPublicationIds);
  await runQueue(propertyId);
  return { ok: true, panel: await getPublishingPanel(propertyId) };
}

export async function retrySync(
  propertyId: string,
  publicationId: string,
): Promise<PublishingActionResult> {
  const auth = await authorize(propertyId);
  if (!auth.ok) {
    return { ok: false, error: auth.error, panel: await getPublishingPanel(propertyId) };
  }
  const [pub] = await db
    .select({ id: publications.id })
    .from(publications)
    .where(and(eq(publications.id, publicationId), eq(publications.propertyId, propertyId)));
  if (pub) await retryPublication(pub.id);
  await runQueue(propertyId);
  return { ok: true, panel: await getPublishingPanel(propertyId) };
}

/**
 * The "Publish now" button on a draft (or archived) listing: makes it active, which publishes it
 * on every ticked channel. The same as choosing Active in the form and saving, in one click.
 */
export async function publishNow(propertyId: string): Promise<PublishingActionResult> {
  const auth = await authorize(propertyId);
  if (!auth.ok) {
    return { ok: false, error: auth.error, panel: await getPublishingPanel(propertyId) };
  }
  if (auth.property.status === "draft" || auth.property.status === "archived") {
    await db.update(properties).set({ status: "active" }).where(eq(properties.id, propertyId));
    await syncListing(propertyId);
    updateTag(LISTINGS_TAG);
  }
  // The status badge, the form and this panel all change: re-render the page.
  refresh();
  return { ok: true, panel: await getPublishingPanel(propertyId) };
}

/**
 * Called every few seconds by the publishing panel while something is queued. Each call is also a
 * worker tick: it runs this listing's due syncs (retries whose backoff has passed included). That
 * keeps the queue moving on a serverless host without a separate worker process.
 */
export async function pollPublishing(propertyId: string): Promise<PublishingActionResult> {
  await requireUser();
  const touched = await drainQueue({ propertyId, budgetMs: 8_000 });
  if (touched.has("site") || touched.has("kyero")) updateTag(LISTINGS_TAG);
  return { ok: true, panel: await getPublishingPanel(propertyId) };
}
