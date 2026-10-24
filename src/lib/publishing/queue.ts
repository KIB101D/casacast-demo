import "server-only";
import { realTelegramConfigured } from "@/demo/adapters";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import {
  channels,
  publications,
  syncLogs,
  type ChannelType,
  type SyncAction,
  type UserRole,
} from "@/db/schema";
import { siteUrl } from "@/lib/site-url";
import { nextAttemptAt } from "./backoff";
import { planSync, statusAfterSuccess } from "./plan";
import { adapterFor, INLINE_CHANNELS } from "./registry";
import { loadSnapshot } from "./snapshot";
import { ChannelError, type AdapterResult, type ChannelContext } from "./types";

/**
 * The publishing queue lives in the `publications` table itself: a row with status `queued` and
 * a due `nextAttemptAt` is a job. Workers claim jobs with FOR UPDATE SKIP LOCKED plus a short
 * lease (`lockedUntil`), so several workers (a request's after(), the admin page's poll, the cron)
 * can run at once without posting the same listing twice, and a crashed worker's job comes back
 * when the lease runs out.
 */

const LEASE_SECONDS = 60;

function channelContext(config: Record<string, unknown>): ChannelContext {
  return {
    siteUrl: siteUrl(),
    config,
    env: process.env,
    now: new Date(),
    fetch: globalThis.fetch,
    random: Math.random,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

/**
 * Channels a new listing starts on. Demo version: a sandbox's listing starts on every channel
 * (its Telegram is simulated); the agency's starts on Telegram only when a real bot is set up.
 */
export function enabledByDefault(type: ChannelType, ownerRole: UserRole) {
  if (type !== "telegram" || ownerRole === "demo") return true;
  return realTelegramConfigured(process.env);
}

/** Creates the publication rows a listing is missing (new listings, or a channel added later). */
export async function ensurePublications(propertyId: string, ownerRole: UserRole) {
  const all = await db.select({ id: channels.id, type: channels.type }).from(channels);
  if (all.length === 0) return;
  await db
    .insert(publications)
    .values(
      all.map((channel) => ({
        propertyId,
        channelId: channel.id,
        enabled: enabledByDefault(channel.type, ownerRole),
        status: "queued" as const,
        requestedAt: new Date(),
      })),
    )
    .onConflictDoNothing();
}

/**
 * Asks for a sync of a listing on every channel (or the given ones), after the listing, its photos
 * or its channel choice changed. Failed and backing-off syncs start over: something changed.
 */
export async function requestSync(
  propertyId: string,
  only: { channelIds?: string[]; publicationIds?: string[] } = {},
) {
  const now = new Date();
  await db
    .update(publications)
    .set({ status: "queued", requestedAt: now, nextAttemptAt: now, attempts: 0 })
    .where(
      and(
        eq(publications.propertyId, propertyId),
        only.channelIds ? inArray(publications.channelId, only.channelIds) : undefined,
        only.publicationIds ? inArray(publications.id, only.publicationIds) : undefined,
      ),
    );
}

/** Saves which channels a listing should be on (by publication id) and syncs the changed ones. */
export async function setEnabledPublications(propertyId: string, enabledIds: string[]) {
  const rows = await db
    .select({ id: publications.id, enabled: publications.enabled })
    .from(publications)
    .where(eq(publications.propertyId, propertyId));

  const changed = rows.filter((r) => r.enabled !== enabledIds.includes(r.id));
  for (const row of changed) {
    await db.update(publications).set({ enabled: !row.enabled }).where(eq(publications.id, row.id));
  }
  if (changed.length > 0) {
    await requestSync(propertyId, { publicationIds: changed.map((r) => r.id) });
  }
  return changed.length;
}

export async function retryPublication(publicationId: string) {
  const now = new Date();
  const [row] = await db
    .update(publications)
    .set({ status: "queued", requestedAt: now, nextAttemptAt: now, attempts: 0 })
    .where(eq(publications.id, publicationId))
    .returning({ propertyId: publications.propertyId });
  return row?.propertyId ?? null;
}

/** Claims due jobs for this worker. Returns their ids and the claim time. */
async function claim(options: {
  propertyId?: string;
  types?: readonly ChannelType[];
  limit: number;
}) {
  const claimedAt = new Date();
  const result = await db.execute<{ id: string }>(sql`
    update ${publications} set locked_until = now() + make_interval(secs => ${LEASE_SECONDS})
    where id in (
      select p.id from ${publications} p
      join ${channels} c on c.id = p.channel_id
      where p.status = 'queued'
        and (p.next_attempt_at is null or p.next_attempt_at <= now())
        and (p.locked_until is null or p.locked_until < now())
        ${options.propertyId ? sql`and p.property_id = ${options.propertyId}` : sql``}
        ${options.types ? sql`and c.type in ${options.types}` : sql``}
      order by p.next_attempt_at nulls first
      limit ${options.limit}
      for update of p skip locked
    )
    returning id
  `);
  return { ids: result.rows.map((r) => r.id), claimedAt };
}

type Outcome =
  | { kind: "skipped" }
  | { kind: "success"; action: SyncAction | null; result?: AdapterResult }
  | { kind: "error"; action: SyncAction; error: ChannelError };

/** Runs one claimed job: decide, call the channel, record the result. */
async function runJob(publicationId: string, claimedAt: Date): Promise<ChannelType | null> {
  const pub = await db.query.publications.findFirst({
    where: eq(publications.id, publicationId),
    with: { channel: true },
  });
  if (!pub) return null;

  const listing = await loadSnapshot(pub.propertyId, siteUrl());
  if (!listing) return null; // deleted meanwhile; the row went with it

  const plan = planSync({
    enabled: pub.enabled && pub.channel.enabled,
    propertyStatus: listing.status,
    status: pub.status,
    externalId: pub.externalId,
  });

  const adapter = adapterFor(pub.channel.type);
  const ctx = channelContext(pub.channel.config);
  const started = Date.now();
  let outcome: Outcome;

  if (plan.action === null) {
    outcome = { kind: "success", action: null };
  } else {
    try {
      const externalId = pub.externalId ?? "";
      const result =
        plan.action === "unpublish"
          ? await adapter.unpublish(listing, externalId, plan.reason, ctx)
          : plan.action === "update"
            ? await adapter.update(listing, externalId, ctx)
            : await adapter.publish(listing, ctx);
      outcome = { kind: "success", action: plan.action, result };
    } catch (error) {
      const channelError =
        error instanceof ChannelError
          ? error
          : new ChannelError(error instanceof Error ? error.message : String(error), {
              retryable: true,
            });
      outcome = { kind: "error", action: plan.action, error: channelError };
    }
  }
  const durationMs = Date.now() - started;

  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ requestedAt: publications.requestedAt })
      .from(publications)
      .where(eq(publications.id, publicationId))
      .for("update");
    if (!current) return;
    // Something changed while we were calling the channel: sync again with the new data.
    const requestedAgain = current.requestedAt !== null && current.requestedAt > claimedAt;
    const now = new Date();

    if (outcome.kind === "success") {
      const result = outcome.result;
      await tx
        .update(publications)
        .set({
          status: requestedAgain ? "queued" : statusAfterSuccess(outcome.action),
          ...(result && result.externalId !== undefined ? { externalId: result.externalId } : {}),
          ...(result && result.url !== undefined ? { url: result.url } : {}),
          ...(outcome.action ? { lastSyncedAt: now } : {}),
          attempts: 0,
          nextAttemptAt: requestedAgain ? now : null,
          lockedUntil: null,
          lastError: null,
        })
        .where(eq(publications.id, publicationId));
      if (outcome.action) {
        await tx.insert(syncLogs).values({
          publicationId,
          action: outcome.action,
          result: "success",
          attempt: pub.attempts + 1,
          detail: result?.detail,
          durationMs,
        });
      }
    } else {
      const attempts = pub.attempts + 1;
      const retryAt = nextAttemptAt(attempts, now, outcome.error);
      await tx
        .update(publications)
        .set({
          status: requestedAgain || retryAt ? "queued" : "failed",
          attempts: requestedAgain ? 0 : attempts,
          nextAttemptAt: requestedAgain ? now : retryAt,
          lockedUntil: null,
          lastError: outcome.error.message,
        })
        .where(eq(publications.id, publicationId));
      await tx.insert(syncLogs).values({
        publicationId,
        action: outcome.action,
        result: "error",
        attempt: attempts,
        detail: retryAt ? "Will retry" : "Gave up",
        error: outcome.error.message,
        durationMs,
      });
    }
  });

  return pub.channel.type;
}

/**
 * Works through due jobs until there are none or the time budget runs out (serverless functions
 * have a time limit). Returns the channel types it touched, so callers can expire caches.
 */
export async function drainQueue(
  options: { propertyId?: string; inlineOnly?: boolean; budgetMs?: number } = {},
) {
  const deadline = Date.now() + (options.budgetMs ?? 20_000);
  const touched = new Set<ChannelType>();
  while (Date.now() < deadline) {
    const { ids, claimedAt } = await claim({
      propertyId: options.propertyId,
      types: options.inlineOnly ? INLINE_CHANNELS : undefined,
      limit: 5,
    });
    if (ids.length === 0) break;
    for (const id of ids) {
      const type = await runJob(id, claimedAt);
      if (type) touched.add(type);
    }
  }
  return touched;
}

/**
 * What the admin's Server Actions call after a change: queue a sync, run the inline channels
 * (site, feed) right away so the page shows the result, and hand the remote ones to after(),
 * which runs once the response is sent. The admin page's poll picks up anything left over.
 *
 * The inline part can't move into after() too: the caller expires the catalogue cache once it
 * returns, and after() runs during the page's re-render, where cache expiry isn't allowed.
 *
 * `photosOnly`: photo changes only matter to the inline channels (the feed lists photos and needs
 * one; a Telegram post keeps its first photo), so remote channels aren't touched.
 */
export async function syncListing(propertyId: string, options: { photosOnly?: boolean } = {}) {
  const channelIds = options.photosOnly
    ? (
        await db
          .select({ id: channels.id })
          .from(channels)
          .where(inArray(channels.type, INLINE_CHANNELS))
      ).map((c) => c.id)
    : undefined;
  await requestSync(propertyId, { channelIds });
  await drainQueue({ propertyId, inlineOnly: true, budgetMs: 5_000 });
  if (!options.photosOnly) after(() => drainQueue({ propertyId }));
}

/**
 * Before a listing is deleted: take it down from remote channels while we still know where it is
 * (the publication rows go with the listing). Best effort: a failure is logged, not fatal.
 */
export async function withdrawEverywhere(propertyId: string) {
  const live = await db.query.publications.findMany({
    where: and(eq(publications.propertyId, propertyId), isNotNull(publications.externalId)),
    with: { channel: true },
  });
  const remote = live.filter((p) => adapterFor(p.channel.type).mode === "remote");
  if (remote.length === 0) return;
  const listing = await loadSnapshot(propertyId, siteUrl());
  if (!listing) return;

  const results = await Promise.allSettled(
    remote.map((p) =>
      adapterFor(p.channel.type).unpublish(
        listing,
        p.externalId!,
        "withdrawn",
        channelContext(p.channel.config),
      ),
    ),
  );
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(
        `Could not remove ${listing.reference} from ${remote[i]!.channel.type}:`,
        r.reason,
      );
    }
  });
}
