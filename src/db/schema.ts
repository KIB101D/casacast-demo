import { relations, sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Column names are written in camelCase here and stored as snake_case
// (see `casing: "snake_case"` in drizzle.config.ts and src/db/index.ts).

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

// ---------- Enums ----------

export const userRole = pgEnum("user_role", ["admin", "demo"]);

/** Subset of the Kyero XML property types, so the feed maps 1:1. */
export const propertyType = pgEnum("property_type", [
  "flat",
  "chalet",
  "bungalow",
  "country_house",
  "land",
  "shop",
]);

export const operation = pgEnum("operation", ["sale", "rent"]);

export const propertyStatus = pgEnum("property_status", ["draft", "active", "sold", "archived"]);

/** ISO 639-1 codes: Ukrainian is `uk`, not `ua`. */
export const locale = pgEnum("locale", ["es", "en", "uk"]);

export const channelType = pgEnum("channel_type", ["site", "kyero", "telegram", "mock_portal"]);

export const publicationStatus = pgEnum("publication_status", [
  "queued",
  "published",
  "failed",
  "removed",
]);

export const syncAction = pgEnum("sync_action", ["publish", "update", "unpublish"]);

export const syncResult = pgEnum("sync_result", ["success", "error"]);

export const leadStatus = pgEnum("lead_status", ["new", "in_progress", "handled"]);

export const messageDirection = pgEnum("message_direction", ["outbound", "inbound"]);

/**
 * outbound: sending → sent | failed, or `simulated` for the demo (shown, never sent).
 * inbound: always `received`.
 */
export const messageStatus = pgEnum("message_status", [
  "sending",
  "sent",
  "failed",
  "simulated",
  "received",
]);

// ---------- Tables ----------

export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  name: text().notNull(),
  /** Null for the demo user, who signs in without a password. */
  passwordHash: text(),
  role: userRole().notNull(),
  ...timestamps,
});

export const properties = pgTable(
  "properties",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Human-readable reference shown to clients and sent to portals, e.g. "CB-0007". */
    reference: text().notNull().unique(),
    type: propertyType().notNull(),
    operation: operation().notNull(),
    status: propertyStatus().notNull().default("draft"),
    /** Whole euros. For rentals: per month. */
    price: integer().notNull(),
    bedrooms: integer().notNull(),
    bathrooms: integer().notNull(),
    /** Built area, m². For land, the plot size. */
    area: integer().notNull(),
    /** Plot size, m², for houses with land. Null for flats, and for land (where `area` is the plot). */
    plotArea: integer(),
    town: text().notNull(),
    province: text().notNull().default("Alicante"),
    latitude: doublePrecision(),
    longitude: doublePrecision(),
    createdById: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index().on(t.status), index().on(t.createdById)],
);

export const propertyTranslations = pgTable(
  "property_translations",
  {
    id: uuid().primaryKey().defaultRandom(),
    propertyId: uuid()
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    locale: locale().notNull(),
    title: text().notNull(),
    description: text().notNull(),
  },
  (t) => [uniqueIndex().on(t.propertyId, t.locale)],
);

export const photos = pgTable(
  "photos",
  {
    id: uuid().primaryKey().defaultRandom(),
    propertyId: uuid()
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    /** Cloudinary public id; the delivery URL is built from it. */
    publicId: text().notNull(),
    url: text().notNull(),
    width: integer().notNull(),
    height: integer().notNull(),
    position: integer().notNull(),
    isCover: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index().on(t.propertyId, t.position),
    // At most one cover per listing, enforced by the database rather than by convention.
    uniqueIndex("photos_one_cover_per_property")
      .on(t.propertyId)
      .where(sql`${t.isCover}`),
  ],
);

export const channels = pgTable("channels", {
  id: uuid().primaryKey().defaultRandom(),
  type: channelType().notNull().unique(),
  name: text().notNull(),
  /** Channel-specific settings (e.g. Telegram chat ids). Never secrets: those live in env vars. */
  config: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  enabled: boolean().notNull().default(true),
  ...timestamps,
});

export const publications = pgTable(
  "publications",
  {
    id: uuid().primaryKey().defaultRandom(),
    propertyId: uuid()
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    channelId: uuid()
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    /** The agent's choice: should this listing be on this channel? */
    enabled: boolean().notNull().default(true),
    /**
     * Where the channel is at. `queued` means "needs a sync": the worker compares the wanted state
     * (enabled + listing status) with what the channel has, and publishes, updates or removes.
     */
    status: publicationStatus().notNull().default("queued"),
    /** Id the channel gave us back (e.g. Telegram message id). Kept while the post exists. */
    externalId: text(),
    /** Public link to the listing on the channel, when there is one. */
    url: text(),
    lastSyncedAt: timestamp({ withTimezone: true }),
    /** Last time something asked for a sync. A sync that started earlier leaves the row queued. */
    requestedAt: timestamp({ withTimezone: true }),
    /** Failed attempts since the last success; drives the backoff. */
    attempts: integer().notNull().default(0),
    /** A queued sync waits until this time (retry backoff). */
    nextAttemptAt: timestamp({ withTimezone: true }),
    /** Set while a worker runs this sync, so two workers never post the same listing twice. */
    lockedUntil: timestamp({ withTimezone: true }),
    lastError: text(),
    ...timestamps,
  },
  (t) => [uniqueIndex().on(t.propertyId, t.channelId), index().on(t.status, t.nextAttemptAt)],
);

export const syncLogs = pgTable(
  "sync_logs",
  {
    id: uuid().primaryKey().defaultRandom(),
    publicationId: uuid()
      .notNull()
      .references(() => publications.id, { onDelete: "cascade" }),
    action: syncAction().notNull(),
    result: syncResult().notNull(),
    /** 1 for the first try, 2 for the first retry, … */
    attempt: integer().notNull().default(1),
    /** What happened, in a line: "Posted to the test channel", "In the feed", the error message. */
    detail: text(),
    error: text(),
    durationMs: integer(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index().on(t.publicationId, t.createdAt)],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid().primaryKey().defaultRandom(),
    propertyId: uuid().references(() => properties.id, { onDelete: "set null" }),
    name: text().notNull(),
    email: text().notNull(),
    phone: text(),
    message: text().notNull(),
    status: leadStatus().notNull().default("new"),
    /** Short id in the agency's reply-to address (agency+lead-<token>@…), tying replies to this lead. */
    replyToken: text().unique(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index().on(t.status, t.createdAt)],
);

/** The email conversation about a lead, after the enquiry itself (which stays on the lead). */
export const leadMessages = pgTable(
  "lead_messages",
  {
    id: uuid().primaryKey().defaultRandom(),
    leadId: uuid()
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    direction: messageDirection().notNull(),
    status: messageStatus().notNull(),
    /** Plain text. For inbound mail, only the new part: quoted history is cut off. */
    body: text().notNull(),
    subject: text(),
    fromAddress: text(),
    /** RFC 5322 Message-ID, for threading and to never import the same email twice. */
    messageId: text().unique(),
    inReplyTo: text(),
    error: text(),
    /** Who wrote an outbound message. */
    sentById: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index().on(t.leadId, t.createdAt)],
);

/** Where the inbox sync stopped: IMAP UIDs only grow within one UIDVALIDITY. */
export const mailSyncState = pgTable("mail_sync_state", {
  mailbox: text().primaryKey(),
  uidValidity: text(),
  lastUid: integer().notNull().default(0),
  /** Lease so two syncs never read the inbox at once. */
  lockedUntil: timestamp({ withTimezone: true }),
  lastSyncedAt: timestamp({ withTimezone: true }),
  lastError: text(),
});

// ---------- Relations (for db.query.* with `with`) ----------

export const usersRelations = relations(users, ({ many }) => ({
  properties: many(properties),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  createdBy: one(users, { fields: [properties.createdById], references: [users.id] }),
  translations: many(propertyTranslations),
  photos: many(photos),
  publications: many(publications),
  leads: many(leads),
}));

export const propertyTranslationsRelations = relations(propertyTranslations, ({ one }) => ({
  property: one(properties, {
    fields: [propertyTranslations.propertyId],
    references: [properties.id],
  }),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  property: one(properties, { fields: [photos.propertyId], references: [properties.id] }),
}));

export const channelsRelations = relations(channels, ({ many }) => ({
  publications: many(publications),
}));

export const publicationsRelations = relations(publications, ({ one, many }) => ({
  property: one(properties, { fields: [publications.propertyId], references: [properties.id] }),
  channel: one(channels, { fields: [publications.channelId], references: [channels.id] }),
  logs: many(syncLogs),
}));

export const syncLogsRelations = relations(syncLogs, ({ one }) => ({
  publication: one(publications, {
    fields: [syncLogs.publicationId],
    references: [publications.id],
  }),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  property: one(properties, { fields: [leads.propertyId], references: [properties.id] }),
  messages: many(leadMessages),
}));

export const leadMessagesRelations = relations(leadMessages, ({ one }) => ({
  lead: one(leads, { fields: [leadMessages.leadId], references: [leads.id] }),
}));

// ---------- Inferred types ----------

export type User = typeof users.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type PropertyTranslation = typeof propertyTranslations.$inferSelect;
export type Locale = (typeof locale.enumValues)[number];
export type PropertyType = (typeof propertyType.enumValues)[number];
export type PropertyStatus = (typeof propertyStatus.enumValues)[number];
export type UserRole = (typeof userRole.enumValues)[number];
export type ChannelType = (typeof channelType.enumValues)[number];
export type PublicationStatus = (typeof publicationStatus.enumValues)[number];
export type SyncAction = (typeof syncAction.enumValues)[number];
export type Publication = typeof publications.$inferSelect;
export type LeadMessage = typeof leadMessages.$inferSelect;
