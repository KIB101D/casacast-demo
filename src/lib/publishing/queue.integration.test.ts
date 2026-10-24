/**
 * The queue against a real Postgres: claiming, retries and the "changed while syncing" case.
 * Runs when DATABASE_URL is set (CI runs it after migrating and seeding); skipped otherwise.
 */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("publishing queue (database)", () => {
  // Imported here, not at the top: the db client throws on import without DATABASE_URL.
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let queue: typeof import("./queue");

  let propertyId = "";
  let portalPublicationId = "";

  const portal = async () =>
    (await db.query.publications.findFirst({
      where: eq(schema.publications.id, portalPublicationId),
    }))!;
  const logs = async () =>
    db.select().from(schema.syncLogs).where(eq(schema.syncLogs.publicationId, portalPublicationId));

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    queue = await import("./queue");

    const [admin] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.role, "admin"))
      .limit(1);
    const [created] = await db
      .insert(schema.properties)
      .values({
        reference: `IT-${randomUUID().slice(0, 8)}`,
        type: "flat",
        operation: "sale",
        status: "active",
        price: 100000,
        bedrooms: 1,
        bathrooms: 1,
        area: 50,
        town: "Alicante",
        createdById: admin!.id,
      })
      .returning({ id: schema.properties.id });
    propertyId = created!.id;
    await db.insert(schema.propertyTranslations).values({
      propertyId,
      locale: "en",
      title: "Integration test flat",
      description:
        "A flat used by the queue's integration test. Long enough for the partner portal to accept it.",
    });
    await queue.ensurePublications(propertyId, "admin");

    // Only the partner portal is on; the others would add noise.
    const rows = await db.query.publications.findMany({
      where: eq(schema.publications.propertyId, propertyId),
      with: { channel: true },
    });
    portalPublicationId = rows.find((r) => r.channel.type === "mock_portal")!.id;
    await db
      .update(schema.publications)
      .set({ enabled: false, status: "removed" })
      .where(eq(schema.publications.propertyId, propertyId));
    await db
      .update(schema.publications)
      .set({ enabled: true })
      .where(eq(schema.publications.id, portalPublicationId));
  });

  beforeEach(async () => {
    await db.delete(schema.syncLogs).where(eq(schema.syncLogs.publicationId, portalPublicationId));
  });

  afterAll(async () => {
    if (propertyId) await db.delete(schema.properties).where(eq(schema.properties.id, propertyId));
  });

  it("publishes once even when several workers drain at the same time", async () => {
    process.env.MOCK_PORTAL_FAILURE_RATE = "0";
    await queue.requestSync(propertyId);
    await Promise.all([
      queue.drainQueue({ propertyId }),
      queue.drainQueue({ propertyId }),
      queue.drainQueue({ propertyId }),
    ]);
    const pub = await portal();
    expect(pub.status).toBe("published");
    expect(pub.externalId).toMatch(/^MP-/);
    const entries = await logs();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ action: "publish", result: "success" });
  });

  it("backs off after a retryable failure and doesn't run again before it is due", async () => {
    process.env.MOCK_PORTAL_FAILURE_RATE = "1";
    await queue.requestSync(propertyId);
    await queue.drainQueue({ propertyId });
    let pub = await portal();
    expect(pub.status).toBe("queued");
    expect(pub.attempts).toBe(1);
    expect(pub.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now() + 5_000);
    expect(pub.lastError).toMatch(/503|timed out/);

    await queue.drainQueue({ propertyId }); // not due yet: nothing happens
    expect(await logs()).toHaveLength(1);

    // Make it due, and let it succeed: the attempt counter resets.
    process.env.MOCK_PORTAL_FAILURE_RATE = "0";
    await db
      .update(schema.publications)
      .set({ nextAttemptAt: new Date(Date.now() - 1000) })
      .where(eq(schema.publications.id, portalPublicationId));
    await queue.drainQueue({ propertyId });
    pub = await portal();
    expect(pub).toMatchObject({ status: "published", attempts: 0, lastError: null });
    const entries = await logs();
    expect(entries.map((e) => [e.result, e.attempt]).sort()).toEqual([
      ["error", 1],
      ["success", 2],
    ]);
  });

  it("gives up after the last attempt and shows Failed", async () => {
    process.env.MOCK_PORTAL_FAILURE_RATE = "1";
    await queue.requestSync(propertyId);
    await db
      .update(schema.publications)
      .set({ attempts: 3 })
      .where(eq(schema.publications.id, portalPublicationId));
    await queue.drainQueue({ propertyId });
    expect(await portal()).toMatchObject({ status: "failed", attempts: 4, nextAttemptAt: null });

    process.env.MOCK_PORTAL_FAILURE_RATE = "0";
    await queue.retryPublication(portalPublicationId);
    await queue.drainQueue({ propertyId });
    expect(await portal()).toMatchObject({ status: "published", attempts: 0 });
  });

  it("takes the listing down when it is sold", async () => {
    process.env.MOCK_PORTAL_FAILURE_RATE = "0";
    await db
      .update(schema.properties)
      .set({ status: "sold" })
      .where(eq(schema.properties.id, propertyId));
    await queue.requestSync(propertyId);
    await queue.drainQueue({ propertyId });
    expect(await portal()).toMatchObject({ status: "removed", externalId: null });
    const [entry] = await logs();
    expect(entry).toMatchObject({ action: "unpublish", result: "success" });

    // Syncing again does nothing: there is nothing left to take down.
    await queue.requestSync(propertyId);
    await queue.drainQueue({ propertyId });
    expect(await logs()).toHaveLength(1);
  });

  it("only touches its own listing when asked to", async () => {
    const other = await db
      .select({ id: schema.publications.id })
      .from(schema.publications)
      .where(and(eq(schema.publications.status, "queued")));
    const touched = await queue.drainQueue({ propertyId, budgetMs: 2_000 });
    const after = await db
      .select({ id: schema.publications.id })
      .from(schema.publications)
      .where(eq(schema.publications.status, "queued"));
    expect(touched.size).toBe(0);
    expect(after.length).toBe(other.length);
  });
});
