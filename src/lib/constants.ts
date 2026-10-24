export const LOCALES = ["es", "en", "uk"] as const;

export const LOCALE_LABELS: Record<(typeof LOCALES)[number], string> = {
  es: "Español",
  en: "English",
  uk: "Українська",
};

/** The product: the back office and its publishing engine. */
export const PRODUCT_NAME = "Casacast";

/** The agency whose public site the demo runs. Change here to rebrand the demo. */
export const AGENCY_NAME = "Casacast";

/** Placeholder contact details for the demo agency. `.example` is a reserved domain that never resolves. */
export const AGENCY_CONTACT = {
  phone: "+34 600 000 000",
  email: "hola@casacast.example",
  /** Central Alicante, for the office map. */
  latitude: 38.3452,
  longitude: -0.481,
} as const;
