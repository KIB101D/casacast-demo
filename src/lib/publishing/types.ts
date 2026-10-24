import type { ChannelType, Locale, PropertyStatus, PropertyType, UserRole } from "@/db/schema";

/**
 * Everything a channel needs to know about a listing, loaded once per sync. Adapters get this
 * plain object, never the database, so they are easy to test and can't change anything else.
 */
export type ListingSnapshot = {
  id: string;
  reference: string;
  type: PropertyType;
  operation: "sale" | "rent";
  status: PropertyStatus;
  price: number;
  bedrooms: number;
  bathrooms: number;
  /** Built area, m²; for land, the plot. */
  area: number;
  /** Plot, m², for houses with land. */
  plotArea: number | null;
  town: string;
  province: string;
  latitude: number | null;
  longitude: number | null;
  translations: { locale: Locale; title: string; description: string }[];
  /** Absolute URLs, cover first. */
  photos: string[];
  /** Absolute URL of the listing page on the agency site, per language. */
  pageUrls: Record<Locale, string>;
  updatedAt: Date;
  /** Who created the listing: demo listings go to test destinations only. */
  ownerRole: UserRole;
};

/** Why a listing leaves a channel. Channels may treat them differently (Telegram marks "sold"). */
export type UnpublishReason = "sold" | "withdrawn";

export type ChannelContext = {
  /** Base URL of the agency site, for links back to it. */
  siteUrl: URL;
  /** The `channels.config` JSON for this channel. Never secrets: those come from env. */
  config: Record<string, unknown>;
  env: Record<string, string | undefined>;
  now: Date;
  /** Injected so tests can stub the network. */
  fetch: typeof fetch;
  /** Injected so tests can make the mock portal deterministic. */
  random: () => number;
  sleep: (ms: number) => Promise<void>;
};

export type AdapterResult = {
  /** The id to keep for later updates. `null` clears it (the post is gone). Omit to keep it. */
  externalId?: string | null;
  url?: string | null;
  /** One line for the sync log: "Posted to the test channel", "In the feed". */
  detail: string;
};

/**
 * One interface for every channel. A new channel is a new object implementing this, plus a line
 * in the registry; the queue, the UI and the logs don't change.
 */
export interface ChannelAdapter {
  readonly type: ChannelType;
  /**
   * `inline` channels only touch our own database (the site, the XML feed), so they sync inside
   * the request that changed the listing. `remote` channels call someone else's API and go
   * through the queue with retries.
   */
  readonly mode: "inline" | "remote";
  publish(listing: ListingSnapshot, ctx: ChannelContext): Promise<AdapterResult>;
  update(listing: ListingSnapshot, externalId: string, ctx: ChannelContext): Promise<AdapterResult>;
  unpublish(
    listing: ListingSnapshot,
    externalId: string,
    reason: UnpublishReason,
    ctx: ChannelContext,
  ): Promise<AdapterResult>;
}

/**
 * A failed call to a channel. `retryable` decides between "try again later" (timeouts, rate
 * limits, 5xx) and "a person has to fix something" (bad data, wrong configuration).
 */
export class ChannelError extends Error {
  readonly retryable: boolean;
  /** Earliest sensible retry, when the channel says so (Telegram's `retry_after`). */
  readonly retryAfterMs?: number;

  constructor(message: string, options: { retryable: boolean; retryAfterMs?: number }) {
    super(message);
    this.name = "ChannelError";
    this.retryable = options.retryable;
    this.retryAfterMs = options.retryAfterMs;
  }
}
