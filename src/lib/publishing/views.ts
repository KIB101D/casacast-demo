import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  channels,
  properties,
  propertyTranslations,
  publications,
  syncLogs,
  type ChannelType,
  type PublicationStatus,
  type SyncAction,
  type UserRole,
} from "@/db/schema";
import { visibleTo } from "@/demo/visibility";

/** One channel row of a listing's publishing panel. Plain JSON, so it can go to the client. */
export type PublicationView = {
  id: string;
  channelType: ChannelType;
  channelName: string;
  channelEnabled: boolean;
  enabled: boolean;
  status: PublicationStatus;
  /** The channel still has something of ours (a post, a feed entry). */
  live: boolean;
  url: string | null;
  lastSyncedAt: string | null;
  attempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
};

export type SyncLogView = {
  id: string;
  channelType: ChannelType;
  channelName: string;
  action: SyncAction;
  result: "success" | "error";
  attempt: number;
  detail: string | null;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
};

export type PublishingPanelData = { publications: PublicationView[]; logs: SyncLogView[] };

const CHANNEL_ORDER: ChannelType[] = ["site", "kyero", "telegram", "mock_portal"];

export async function getPublishingPanel(propertyId: string): Promise<PublishingPanelData> {
  const rows = await db
    .select({
      id: publications.id,
      channelType: channels.type,
      channelName: channels.name,
      channelEnabled: channels.enabled,
      enabled: publications.enabled,
      status: publications.status,
      externalId: publications.externalId,
      url: publications.url,
      lastSyncedAt: publications.lastSyncedAt,
      attempts: publications.attempts,
      nextAttemptAt: publications.nextAttemptAt,
      lastError: publications.lastError,
    })
    .from(publications)
    .innerJoin(channels, eq(channels.id, publications.channelId))
    .where(eq(publications.propertyId, propertyId));

  const logs = await db
    .select({
      id: syncLogs.id,
      channelType: channels.type,
      channelName: channels.name,
      action: syncLogs.action,
      result: syncLogs.result,
      attempt: syncLogs.attempt,
      detail: syncLogs.detail,
      error: syncLogs.error,
      durationMs: syncLogs.durationMs,
      createdAt: syncLogs.createdAt,
    })
    .from(syncLogs)
    .innerJoin(publications, eq(publications.id, syncLogs.publicationId))
    .innerJoin(channels, eq(channels.id, publications.channelId))
    .where(eq(publications.propertyId, propertyId))
    .orderBy(desc(syncLogs.createdAt))
    .limit(20);

  return {
    publications: rows
      .sort((a, b) => CHANNEL_ORDER.indexOf(a.channelType) - CHANNEL_ORDER.indexOf(b.channelType))
      .map(({ externalId, ...r }) => ({
        ...r,
        live: externalId !== null,
        lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
        nextAttemptAt: r.nextAttemptAt?.toISOString() ?? null,
      })),
    logs: logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
  };
}

export type ActivityItem = SyncLogView & { propertyId: string; reference: string; title: string };

/** The latest syncs across all listings, for the Publishing page. */
export async function listRecentActivity(
  viewer: { id: string; role: UserRole },
  limit = 50,
): Promise<ActivityItem[]> {
  const rows = await db
    .select({
      id: syncLogs.id,
      channelType: channels.type,
      channelName: channels.name,
      action: syncLogs.action,
      result: syncLogs.result,
      attempt: syncLogs.attempt,
      detail: syncLogs.detail,
      error: syncLogs.error,
      durationMs: syncLogs.durationMs,
      createdAt: syncLogs.createdAt,
      propertyId: properties.id,
      reference: properties.reference,
    })
    .from(syncLogs)
    .innerJoin(publications, eq(publications.id, syncLogs.publicationId))
    .innerJoin(channels, eq(channels.id, publications.channelId))
    .innerJoin(properties, eq(properties.id, publications.propertyId))
    .where(visibleTo(viewer))
    .orderBy(desc(syncLogs.createdAt))
    .limit(limit);

  const ids = [...new Set(rows.map((r) => r.propertyId))];
  const titles =
    ids.length === 0
      ? []
      : await db
          .select({
            propertyId: propertyTranslations.propertyId,
            locale: propertyTranslations.locale,
            title: propertyTranslations.title,
          })
          .from(propertyTranslations)
          .where(inArray(propertyTranslations.propertyId, ids));
  const titleFor = (id: string) =>
    titles.find((t) => t.propertyId === id && t.locale === "en")?.title ??
    titles.find((t) => t.propertyId === id)?.title ??
    "";

  return rows.map((r) => ({
    ...r,
    title: titleFor(r.propertyId),
    createdAt: r.createdAt.toISOString(),
  }));
}

export type ChannelSummary = {
  type: ChannelType;
  name: string;
  enabled: boolean;
  counts: Partial<Record<PublicationStatus, number>>;
};

/** Per channel: how many listings are published, queued, failed. Only listings that want it. */
export async function listChannelSummaries(viewer: {
  id: string;
  role: UserRole;
}): Promise<ChannelSummary[]> {
  const all = await db.select().from(channels).orderBy(asc(channels.createdAt));
  const counts = await db
    .select({
      channelId: publications.channelId,
      status: publications.status,
      value: sql<number>`count(*)::int`,
    })
    .from(publications)
    .innerJoin(properties, eq(properties.id, publications.propertyId))
    .where(and(eq(publications.enabled, true), visibleTo(viewer)))
    .groupBy(publications.channelId, publications.status);

  return all
    .sort((a, b) => CHANNEL_ORDER.indexOf(a.type) - CHANNEL_ORDER.indexOf(b.type))
    .map((c) => ({
      type: c.type,
      name: c.name,
      enabled: c.enabled,
      counts: Object.fromEntries(
        counts.filter((r) => r.channelId === c.id).map((r) => [r.status, r.value]),
      ),
    }));
}
