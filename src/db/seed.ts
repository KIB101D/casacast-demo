/**
 * Seeds the database with the agency, the publishing channels and 10 listings.
 * Safe to run more than once: everything is upserted (photos on agency listings are kept).
 *
 * Demo version:
 * - the admin account is optional (ADMIN_EMAIL + ADMIN_PASSWORD, for trying it locally). Without
 *   it the listings belong to an agency account nobody can sign in to, and the public demo has
 *   only the "Try the demo" button;
 * - visitors get sandboxes of their own (src/demo/sandbox.ts), so there is no shared demo user;
 * - photos for the agency's listings ship with the repo: public/seed/<reference>/*.jpg.
 *
 *   npm run db:seed
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { count, eq } from "drizzle-orm";
import { imageSize } from "image-size";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { seedChannels, seedProperties } from "./seed-data";

const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!DATABASE_URL) throw new Error("Set DATABASE_URL in .env before seeding.");

/** Owner of the agency's listings when there is no admin: an account with no password. */
const AGENCY_EMAIL = "agency@casacast.invalid";
const SEED_PHOTOS_DIR = path.join(process.cwd(), "public", "seed");

const pool = new Pool({ connectionString: DATABASE_URL });
// The app's db client imports `server-only`, so the seed script builds its own.
const db = drizzle(pool, { schema, casing: "snake_case" });

async function main() {
  let owner: { id: string } | undefined;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    [owner] = await db
      .insert(schema.users)
      .values({ email: ADMIN_EMAIL, name: "Admin", passwordHash, role: "admin" })
      .onConflictDoUpdate({ target: schema.users.email, set: { passwordHash, role: "admin" } })
      .returning({ id: schema.users.id });
  } else {
    [owner] = await db
      .insert(schema.users)
      .values({ email: AGENCY_EMAIL, name: "Casacast", passwordHash: null, role: "admin" })
      .onConflictDoUpdate({ target: schema.users.email, set: { passwordHash: null } })
      .returning({ id: schema.users.id });
  }

  const channelIds = {} as Record<schema.ChannelType, string>;
  for (const channel of seedChannels) {
    const [row] = await db
      .insert(schema.channels)
      .values(channel)
      .onConflictDoUpdate({ target: schema.channels.type, set: { name: channel.name } })
      .returning({ id: schema.channels.id });
    channelIds[channel.type] = row!.id;
  }

  // Agency listings are upserted by reference, not recreated, so photos uploaded to them survive.
  for (const { translations, ...property } of seedProperties) {
    const values = {
      ...property,
      plotArea: property.plotArea ?? null,
      status: "active" as const,
      createdById: owner!.id,
    };
    const [row] = await db
      .insert(schema.properties)
      .values(values)
      .onConflictDoUpdate({ target: schema.properties.reference, set: values })
      .returning({ id: schema.properties.id });

    // The agency's listings are on its site from the start. The feed and the partner portal get a
    // queued sync, run by the back office's worker (validation included); Telegram starts off, so
    // a fresh deploy doesn't post ten listings to a real channel.
    const now = new Date();
    for (const type of schema.channelType.enumValues) {
      const site = type === "site";
      const sync = site
        ? { status: "published" as const, externalId: property.reference, lastSyncedAt: now }
        : { status: "queued" as const, requestedAt: now, nextAttemptAt: now, attempts: 0 };
      await db
        .insert(schema.publications)
        .values({
          propertyId: row!.id,
          channelId: channelIds[type],
          enabled: type !== "telegram",
          ...sync,
        })
        .onConflictDoUpdate({
          target: [schema.publications.propertyId, schema.publications.channelId],
          set: sync,
        });
    }

    await seedPhotos(row!.id, property.reference);

    for (const [locale, text] of Object.entries(translations)) {
      await db
        .insert(schema.propertyTranslations)
        .values({ propertyId: row!.id, locale: locale as schema.Locale, ...text })
        .onConflictDoUpdate({
          target: [schema.propertyTranslations.propertyId, schema.propertyTranslations.locale],
          set: text,
        });
    }
  }

  console.log(
    `Seeded: ${ADMIN_EMAIL ? `admin ${ADMIN_EMAIL}` : "no admin (demo only)"}, ${seedChannels.length} channels, ${seedProperties.length} listings.`,
  );
}

/**
 * Photos from public/seed/<reference>/ (JPG, PNG or WebP, sorted by name; the first is the cover),
 * added to a listing that has none yet. Served as static files, so the demo needs no Cloudinary.
 */
async function seedPhotos(propertyId: string, reference: string) {
  const [existing] = await db
    .select({ value: count() })
    .from(schema.photos)
    .where(eq(schema.photos.propertyId, propertyId));
  if ((existing?.value ?? 0) > 0) return;

  const dir = path.join(SEED_PHOTOS_DIR, reference);
  const files = (await readdir(dir).catch(() => []))
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();
  for (const [position, file] of files.entries()) {
    const { width, height } = imageSize(await readFile(path.join(dir, file)));
    if (!width || !height) continue;
    const url = `/seed/${reference}/${file}`;
    await db.insert(schema.photos).values({
      propertyId,
      publicId: `static:${url}`,
      url,
      width,
      height,
      position,
      isCover: position === 0,
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
