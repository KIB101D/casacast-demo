import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { users, type UserRole } from "@/db/schema";
import { readSession } from "./session";

/**
 * Data Access Layer: the single place that turns the session cookie into a user.
 * Every Server Component, Server Action and Route Handler that touches admin data goes through here,
 * so authorization never depends on proxy.ts alone.
 */

export type CurrentUser = {
  id: string;
  name: string;
  role: UserRole;
};

/** The signed-in user, or null. Checks the database so a deleted user loses access at once. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: { id: true, name: true, role: true },
  });
  return user ?? null;
});

/** The signed-in user; redirects to /login otherwise. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
