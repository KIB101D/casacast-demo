import type { Locale } from "../config";
import { en, type Dictionary } from "./en";
import { es } from "./es";
import { uk } from "./uk";

const dictionaries: Record<Locale, Dictionary> = { es, en, uk };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Replaces {name} placeholders: fill("Photo {current} of {total}", { current: 1, total: 5 }). */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export type { Dictionary };
