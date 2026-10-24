"use server";

import { redirect } from "next/navigation";
import * as z from "zod";
import { safeNextPath } from "@/lib/auth/redirect";
import { createSession, deleteSession } from "@/lib/auth/session";
import { adminSignInEnabled, signInAdmin } from "@/demo/admin";
import { hit, visitorKey, WINDOWS } from "@/demo/rate-limit";
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

/**
 * Demo version: the admin signs in with ADMIN_EMAIL and ADMIN_PASSWORD from the environment
 * (src/demo/admin.ts). Without them, as on the public demo, admin sign-in is switched off. Attempts
 * are rate-limited per connection.
 */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const { t } = await getAdminI18n();
  if (!adminSignInEnabled()) return { error: t.login.adminDisabled };

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
  if (!(await hit(`login:ip:${await visitorKey()}`, 10, WINDOWS.tenMinutes))) {
    return { error: t.login.tooManyAttempts, email };
  }
  const userId = await signInAdmin(email, password);
  if (!userId) return { error: t.login.wrongCredentials, email };

  await createSession({ userId, role: "admin" });
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
