import { notFound } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { DEFAULT_LOCALE, hasLocale, type Locale } from "./config";

/** The page language from the URL. Unknown prefixes like /fr are a 404 (caught by [locale]/not-found). */
export async function currentLocale(): Promise<Locale> {
  const value = await localeParam();
  if (!hasLocale(value)) notFound();
  return value;
}

/**
 * The page language, or the default for unknown prefixes. For the layout and the not-found page:
 * they must render even for /fr, otherwise there's nothing to show the 404 inside.
 */
export async function layoutLocale(): Promise<Locale> {
  const value = await localeParam();
  return hasLocale(value) ? value : DEFAULT_LOCALE;
}
