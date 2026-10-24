import { LOCALES } from "@/lib/constants";

export { LOCALES };
export type Locale = (typeof LOCALES)[number];

/** Spanish is the agency's working language and the one every listing has. */
export const DEFAULT_LOCALE: Locale = "es";

/** BCP 47 tags for Intl formatting and hreflang. */
export const INTL_LOCALE: Record<Locale, string> = {
  es: "es-ES",
  en: "en-GB",
  uk: "uk-UA",
};

/** Native names, so each language is recognisable to the people who read it. */
export const LOCALE_NAMES: Record<Locale, string> = {
  es: "Español",
  en: "English",
  uk: "Українська",
};

export function hasLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Picks the best supported locale from an Accept-Language header,
 * e.g. "uk-UA,uk;q=0.9,en;q=0.8" → "uk". Falls back to Spanish.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const quality = q ? Number.parseFloat(q.slice(2)) : 1;
      return { base: tag.toLowerCase().split("-")[0] ?? "", quality, index };
    })
    .filter((entry) => entry.base && Number.isFinite(entry.quality) && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  for (const { base } of ranked) {
    if (hasLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/** Plural forms as Intl.PluralRules names them. `other` is always required. */
export type PluralForms = { one?: string; few?: string; many?: string; other: string };

/** "{n}" in the chosen form is replaced by the formatted number. */
export function plural(locale: Locale, count: number, forms: PluralForms): string {
  const rule = new Intl.PluralRules(INTL_LOCALE[locale]).select(count) as keyof PluralForms;
  const template = forms[rule] ?? forms.other;
  return template.replace("{n}", new Intl.NumberFormat(INTL_LOCALE[locale]).format(count));
}
