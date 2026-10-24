import { LOCALES } from "@/lib/constants";
import { isListedTown, OTHER_TOWN } from "./towns";

/** Flat string values for the property form, keyed by field name. */
export type PropertyFormValues = Record<string, string>;

export const EMPTY_PROPERTY_VALUES: PropertyFormValues = {
  type: "flat",
  operation: "sale",
  status: "draft",
  price: "",
  bedrooms: "",
  bathrooms: "",
  area: "",
  plotArea: "",
  town: "",
  townOther: "",
  province: "Alicante",
  latitude: "",
  longitude: "",
};

/** What the user just submitted, so a failed save doesn't wipe the form. */
export function valuesFromFormData(formData: FormData): PropertyFormValues {
  const values: PropertyFormValues = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}

export function valuesFromProperty(property: {
  type: string;
  operation: string;
  status: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  area: number;
  plotArea: number | null;
  town: string;
  province: string;
  latitude: number | null;
  longitude: number | null;
  translations: { locale: string; title: string; description: string }[];
}): PropertyFormValues {
  const values: PropertyFormValues = {
    type: property.type,
    operation: property.operation,
    status: property.status,
    price: String(property.price),
    bedrooms: String(property.bedrooms),
    bathrooms: String(property.bathrooms),
    area: String(property.area),
    plotArea: property.plotArea?.toString() ?? "",
    // A town outside the list shows as "Other…" with the name typed in.
    town: isListedTown(property.town) ? property.town : OTHER_TOWN,
    townOther: isListedTown(property.town) ? "" : property.town,
    province: property.province,
    latitude: property.latitude?.toString() ?? "",
    longitude: property.longitude?.toString() ?? "",
  };
  for (const locale of LOCALES) {
    const t = property.translations.find((tr) => tr.locale === locale);
    values[`translations.${locale}.title`] = t?.title ?? "";
    values[`translations.${locale}.description`] = t?.description ?? "";
  }
  return values;
}
