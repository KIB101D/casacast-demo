"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { ADMIN_LOCALE_COOKIE, isAdminLocale } from ".";

/** Remembers the back-office language for a year and re-renders the page in it. */
export async function setAdminLocale(locale: string) {
  if (!isAdminLocale(locale)) return;
  (await cookies()).set(ADMIN_LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
  });
  refresh();
}
