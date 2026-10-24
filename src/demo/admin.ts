import "server-only";
import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * The admin in the demo version is whoever holds ADMIN_EMAIL and ADMIN_PASSWORD from the
 * environment. Set both in .env to sign in as admin locally (no re-seeding needed); leave them unset
 * on the public demo, where the admin form is shown but switched off.
 */
export function adminCredentials(): { email: string; password: string } | null {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  return email && password ? { email, password } : null;
}

export function adminSignInEnabled() {
  return adminCredentials() !== null;
}

function sameText(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // Compared in constant time; different lengths are compared against themselves for the same cost.
  return left.length === right.length ? timingSafeEqual(left, right) : !timingSafeEqual(left, left);
}

/** The admin's user id when the credentials match the environment, creating the row if needed. */
export async function signInAdmin(email: string, password: string): Promise<string | null> {
  const expected = adminCredentials();
  if (!expected) return null;
  const ok =
    sameText(email.trim().toLowerCase(), expected.email) && sameText(password, expected.password);
  if (!ok) return null;

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(users)
    .values({ email: expected.email, name: "Admin", passwordHash, role: "admin" })
    .onConflictDoUpdate({ target: users.email, set: { passwordHash, role: "admin" } })
    .returning({ id: users.id });
  return user!.id;
}
