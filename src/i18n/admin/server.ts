import "server-only";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import {
  ADMIN_LOCALE_COOKIE,
  adminI18n,
  isAdminLocale,
  negotiateAdminLocale,
  type AdminDictionary,
  type AdminLocale,
} from ".";

/** The back-office language: the switcher's cookie, or the browser's preference. */
export const getAdminLocale = cache(async (): Promise<AdminLocale> => {
  const stored = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  if (isAdminLocale(stored)) return stored;
  return negotiateAdminLocale((await headers()).get("accept-language"));
});

/** Strings and formatters for server components and Server Actions. */
export async function getAdminI18n() {
  return adminI18n(await getAdminLocale());
}

/** `generateMetadata` for a back-office page whose title is one of the `meta` strings. */
export function adminTitle(key: keyof AdminDictionary["meta"]) {
  return async (): Promise<Metadata> => ({ title: (await getAdminI18n()).t.meta[key] });
}
