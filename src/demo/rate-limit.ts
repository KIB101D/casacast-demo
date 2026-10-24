import "server-only";
import { createHash } from "node:crypto";
import { lt, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { demoRateLimits } from "./schema";

const HOUR = 60 * 60 * 1000;
export const WINDOWS = { tenMinutes: 10 * 60 * 1000, hour: HOUR, day: 24 * HOUR } as const;

/**
 * Counts one more hit for `key` in the current fixed window and says whether it is still within
 * `limit`. One upsert, so concurrent requests can't both slip under the limit.
 */
export async function hit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const [row] = await db
    .insert(demoRateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [demoRateLimits.key, demoRateLimits.windowStart],
      set: { count: sql`${demoRateLimits.count} + 1` },
    })
    .returning({ count: demoRateLimits.count });
  return (row?.count ?? 1) <= limit;
}

/**
 * The visitor's IP, hashed: enough to rate-limit, without keeping addresses. Vercel puts the
 * client address first in x-forwarded-for.
 */
export async function visitorKey(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/** Old windows are useless; the nightly reset drops them. */
export async function pruneRateLimits() {
  await db
    .delete(demoRateLimits)
    .where(lt(demoRateLimits.windowStart, new Date(Date.now() - 2 * WINDOWS.day)));
}
