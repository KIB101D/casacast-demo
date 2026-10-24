import { INTL_LOCALE, type Locale } from "./config";

/** Whole euros, written the way each language writes them: "189.000 €", "€189,000", "189 000 €". */
export function formatEuros(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: "EUR",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatArea(squareMetres: number, locale: Locale): string {
  return `${new Intl.NumberFormat(INTL_LOCALE[locale]).format(squareMetres)} m²`;
}
