import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";
import { DEMO_LIMITS, SANDBOX_EMAIL_DOMAIN } from "./config";
import { hit, visitorKey, WINDOWS } from "./rate-limit";

export type SandboxResult = { ok: true; userId: string; fresh: boolean } | { ok: false };

/**
 * The visitor's sandbox: their current one if the session still points at it, otherwise a new
 * demo user of their own. Limits and visibility then work per visitor, with no shared demo account
 * for one person to fill up or mess with. The nightly reset deletes every sandbox.
 */
export async function openSandbox(): Promise<SandboxResult> {
  const current = await getCurrentUser();
  if (current?.role === "demo") return { ok: true, userId: current.id, fresh: false };

  const visitor = await visitorKey();
  const allowed =
    (await hit(`sandbox:ip:${visitor}`, DEMO_LIMITS.sandboxesPerIpPerHour, WINDOWS.hour)) &&
    (await hit("sandbox:all", DEMO_LIMITS.sandboxesPerDay, WINDOWS.day));
  if (!allowed) return { ok: false };

  const [user] = await db
    .insert(users)
    .values({
      email: `${randomUUID()}@${SANDBOX_EMAIL_DOMAIN}`,
      name: "Demo",
      passwordHash: null,
      role: "demo",
    })
    .returning({ id: users.id });
  return { ok: true, userId: user!.id, fresh: true };
}
