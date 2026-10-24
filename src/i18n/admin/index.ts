import { INTL_LOCALE } from "@/i18n/config";
import { en, type AdminDictionary } from "./en";
import { uk } from "./uk";

/** Languages of the back office. Spanish isn't one: the agents work in English or Ukrainian. */
export const ADMIN_LOCALES = ["en", "uk"] as const;
export type AdminLocale = (typeof ADMIN_LOCALES)[number];
export const DEFAULT_ADMIN_LOCALE: AdminLocale = "en";

/** The cookie that remembers the back-office language. The public site uses the URL instead. */
export const ADMIN_LOCALE_COOKIE = "admin_lang";

export const ADMIN_LOCALE_NAMES: Record<AdminLocale, string> = {
  en: "English",
  uk: "Українська",
};

const DICTIONARIES: Record<AdminLocale, AdminDictionary> = { en, uk };

export function isAdminLocale(value: unknown): value is AdminLocale {
  return typeof value === "string" && (ADMIN_LOCALES as readonly string[]).includes(value);
}

/** Ukrainian if the browser prefers it to English, else English. */
export function negotiateAdminLocale(acceptLanguage: string | null | undefined): AdminLocale {
  const tags = (acceptLanguage ?? "")
    .split(",")
    .map((part) => part.trim().split(";")[0]!.toLowerCase().split("-")[0]);
  const ukIndex = tags.indexOf("uk");
  const enIndex = tags.indexOf("en");
  if (ukIndex !== -1 && (enIndex === -1 || ukIndex < enIndex)) return "uk";
  return DEFAULT_ADMIN_LOCALE;
}

export type AdminFormat = {
  price: (price: number, operation: "sale" | "rent") => string;
  dateTime: (date: Date | string) => string;
};

const formats = new Map<AdminLocale, AdminFormat>();

/** Prices and dates the way the chosen language writes them. */
export function adminFormat(locale: AdminLocale): AdminFormat {
  let format = formats.get(locale);
  if (!format) {
    const euros = new Intl.NumberFormat(INTL_LOCALE[locale], {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    });
    const dateTime = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Madrid",
    });
    const perMonth = DICTIONARIES[locale].common.perMonth;
    format = {
      price: (price, operation) => euros.format(price) + (operation === "rent" ? perMonth : ""),
      dateTime: (date) => dateTime.format(typeof date === "string" ? new Date(date) : date),
    };
    formats.set(locale, format);
  }
  return format;
}

export type AdminI18n = { locale: AdminLocale; t: AdminDictionary; format: AdminFormat };

export function adminI18n(locale: AdminLocale): AdminI18n {
  return { locale, t: DICTIONARIES[locale], format: adminFormat(locale) };
}

export type { AdminDictionary };
