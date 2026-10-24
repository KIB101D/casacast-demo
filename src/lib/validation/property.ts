import * as z from "zod";
import { operation, propertyStatus, propertyType } from "@/db/schema";
import { en, type AdminDictionary } from "@/i18n/admin/en";
import { LOCALES } from "@/lib/constants";
import { OTHER_TOWN } from "@/lib/properties/towns";

/** Turns a form string into a number, or undefined when the field was left empty. */
const toNumber = (v: unknown) => {
  if (typeof v !== "string") return v;
  const trimmed = v.trim();
  return trimmed === "" ? undefined : Number(trimmed);
};

type Messages = AdminDictionary["validation"];
type NumberField = keyof Messages["fields"];

function numberRules(t: Messages, field: NumberField, min: number, max: number) {
  const name = t.fields[field];
  const required = (t.required as Partial<Record<NumberField, string>>)[field];
  return z
    .number({
      error: (issue) => (issue.input === undefined && required ? required : t.number(name)),
    })
    .int({ error: t.whole(name) })
    .min(min, { error: t.atLeast(name, min) })
    .max(max, { error: t.atMost(name, max) });
}

const coordinate = (t: Messages, field: "latitude" | "longitude", limit: number) =>
  z.preprocess(
    toNumber,
    z
      .number({ error: t.number(t.fields[field]) })
      .min(-limit, { error: t.between(t.fields[field], limit) })
      .max(limit, { error: t.between(t.fields[field], limit) })
      .optional(),
  );

const translation = z.object({
  title: z.string().trim(),
  description: z.string().trim(),
});

export const TITLE_LENGTH = { min: 5, max: 120 } as const;
export const DESCRIPTION_LENGTH = { min: 20, max: 5000 } as const;

/** The listing schema, with error messages in the agent's language. */
export function propertyInputSchema(t: Messages) {
  return z.object({
    type: z.enum(propertyType.enumValues, { error: t.chooseType }),
    operation: z.enum(operation.enumValues, { error: t.chooseOperation }),
    status: z.enum(propertyStatus.enumValues, { error: t.chooseStatus }),
    price: z.preprocess(toNumber, numberRules(t, "price", 1, 50_000_000)),
    bedrooms: z.preprocess(toNumber, numberRules(t, "bedrooms", 0, 50)),
    bathrooms: z.preprocess(toNumber, numberRules(t, "bathrooms", 0, 50)),
    area: z.preprocess(toNumber, numberRules(t, "area", 1, 1_000_000)),
    /** Houses with land. Ignored for land, whose `area` is already the plot. */
    plotArea: z.preprocess(toNumber, numberRules(t, "plotArea", 1, 10_000_000).optional()),
    town: z.string().trim().min(2, { error: t.enterTown }).max(80, { error: t.townTooLong }),
    province: z.string().trim().min(2, { error: t.province }).max(80).default("Alicante"),
    latitude: coordinate(t, "latitude", 90),
    longitude: coordinate(t, "longitude", 180),
    translations: z.object({ es: translation, en: translation, uk: translation }),
  });
}

export type PropertyInput = z.output<ReturnType<typeof propertyInputSchema>>;

/** Field errors keyed by the form field name, e.g. "price" or "translations.en.title". */
export type FieldErrors = Record<string, string[]>;

export type ParsedPropertyForm =
  { success: true; data: PropertyInput } | { success: false; fieldErrors: FieldErrors };

type RawTranslations = Record<(typeof LOCALES)[number], { title: string; description: string }>;

/**
 * Rules that span several fields. Kept outside the schema on purpose: Zod skips refinements
 * once a field has failed, and the user should see every problem after one submit.
 */
function crossFieldErrors(
  t: Messages,
  raw: { latitude: string; longitude: string; translations: RawTranslations },
): FieldErrors {
  const errors: FieldErrors = {};
  const add = (key: string, message: string) => (errors[key] ??= []).push(message);

  const hasLat = raw.latitude.trim() !== "";
  const hasLng = raw.longitude.trim() !== "";
  if (hasLat !== hasLng) {
    add(hasLat ? "longitude" : "latitude", t.bothCoordinates);
  }

  for (const locale of LOCALES) {
    const title = raw.translations[locale].title.trim();
    const description = raw.translations[locale].description.trim();
    // Spanish is the primary language; the others are optional but must be complete if started.
    if (locale !== "es" && !title && !description) continue;

    if (title.length < TITLE_LENGTH.min || title.length > TITLE_LENGTH.max) {
      add(`translations.${locale}.title`, t.title(TITLE_LENGTH.min, TITLE_LENGTH.max));
    }
    if (
      description.length < DESCRIPTION_LENGTH.min ||
      description.length > DESCRIPTION_LENGTH.max
    ) {
      add(
        `translations.${locale}.description`,
        t.description(DESCRIPTION_LENGTH.min, DESCRIPTION_LENGTH.max),
      );
    }
  }
  return errors;
}

/**
 * Reads the property form. Field names mirror the schema: `price`, `translations.es.title`, …
 * The town is a list; its "Other…" option sends the typed name as `townOther`.
 */
export function parsePropertyForm(
  formData: FormData,
  t: Messages = en.validation,
): ParsedPropertyForm {
  const get = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };

  const translations = Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      {
        title: get(`translations.${locale}.title`),
        description: get(`translations.${locale}.description`),
      },
    ]),
  ) as RawTranslations;

  const townChoice = get("town");
  const raw = {
    type: get("type"),
    operation: get("operation"),
    status: get("status"),
    price: get("price"),
    bedrooms: get("bedrooms"),
    bathrooms: get("bathrooms"),
    area: get("area"),
    plotArea: get("plotArea"),
    town: townChoice === OTHER_TOWN ? get("townOther") : townChoice,
    province: get("province") || undefined,
    latitude: get("latitude"),
    longitude: get("longitude"),
    translations,
  };

  const fieldErrors = crossFieldErrors(t, raw);
  const result = propertyInputSchema(t).safeParse(raw);

  if (!result.success) {
    for (const issue of result.error.issues) {
      let key = issue.path.join(".") || "form";
      let message = issue.message;
      // A missing town is a choice in the list; a bad typed one belongs to the text box.
      if (key === "town" && townChoice === OTHER_TOWN) key = "townOther";
      else if (key === "town" && !townChoice) message = t.chooseTown;
      if (!fieldErrors[key]) (fieldErrors[key] ??= []).push(message);
    }
  }

  if (!result.success || Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }
  return { success: true, data: result.data };
}

/** Translations the user actually filled in (Spanish always, others only if started). */
export function filledTranslations(input: PropertyInput) {
  return LOCALES.filter(
    (locale) => input.translations[locale].title || input.translations[locale].description,
  ).map((locale) => ({ locale, ...input.translations[locale] }));
}
