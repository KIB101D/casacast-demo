"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import * as z from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { safeNextPath } from "@/lib/auth/redirect";
import { createSession, deleteSession } from "@/lib/auth/session";
import { openSandbox } from "@/demo/sandbox";
import type { AdminDictionary } from "@/i18n/admin";
import { getAdminI18n } from "@/i18n/admin/server";

function loginSchema(t: AdminDictionary["login"]) {
  return z.object({
    email: z.email({ error: t.invalidEmail }).trim().toLowerCase(),
    password: z.string().min(1, { error: t.enterPassword }),
  });
}

export type LoginState = {
  error?: string;
  fieldErrors?: { email?: string[]; password?: string[] };
  email?: string;
};

// Compared against when the email is unknown, so the response time doesn't reveal which emails exist.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hash("not-a-real-password", 12));

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const { t } = await getAdminI18n();
  const parsed = loginSchema(t.login).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      email: String(formData.get("email") ?? ""),
    };
  }

  const { email, password } = parsed.data;
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? (await getDummyHash()));

  if (!user || !user.passwordHash || !passwordOk) {
    return { error: t.login.wrongCredentials, email };
  }

  await createSession({ userId: user.id, role: user.role });
  redirect(safeNextPath(formData.get("next")));
}

/** Demo version: every visitor gets a sandbox of their own (src/demo/sandbox.ts). */
export async function loginAsDemo(formData: FormData) {
  const sandbox = await openSandbox();
  if (!sandbox.ok) redirect("/login?demo=busy");

  if (sandbox.fresh) await createSession({ userId: sandbox.userId, role: "demo" });
  redirect(safeNextPath(formData.get("next")));
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
