import {
  customType,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { leads, users } from "@/db/schema";

/**
 * Tables only the demo version has. They live in their own schema file with their own migrations
 * (drizzle-demo/, tracked in __drizzle_migrations_demo), so the product's migrations in drizzle/
 * stay identical to main and merge without conflicts.
 */

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

/**
 * Photos uploaded by demo visitors. They never go to Cloudinary: anything a stranger uploads stays
 * in our database, is shown only to its author, and is deleted by the nightly reset.
 */
export const demoPhotoBlobs = pgTable("demo_photo_blobs", {
  id: uuid().primaryKey().defaultRandom(),
  contentType: text().notNull(),
  data: bytea().notNull(),
  size: integer().notNull(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

/** Fixed-window counters for rate limits (per visitor IP, and site-wide per day). */
export const demoRateLimits = pgTable(
  "demo_rate_limits",
  {
    key: text().notNull(),
    windowStart: timestamp({ withTimezone: true }).notNull(),
    count: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] }), index().on(t.windowStart)],
);

/**
 * Enquiries sent from a browser that has a demo sandbox: the sandbox sees them in its back office,
 * even when they are about an agency listing or come from the contact page.
 */
export const demoLeadVisitors = pgTable("demo_lead_visitors", {
  leadId: uuid()
    .primaryKey()
    .references(() => leads.id, { onDelete: "cascade" }),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});
