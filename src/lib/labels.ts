import type { PropertyStatus, PropertyType } from "@/db/schema";

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  flat: "Flat",
  chalet: "Villa / chalet",
  bungalow: "Bungalow",
  country_house: "Country house",
  land: "Land",
  shop: "Commercial",
};

export const OPERATION_LABELS = { sale: "For sale", rent: "For rent" } as const;

export const STATUS_LABELS: Record<PropertyStatus, string> = {
  draft: "Draft",
  active: "Active",
  sold: "Sold",
  archived: "Archived",
};

export const STATUS_TONES = {
  draft: "neutral",
  active: "ok",
  sold: "accent",
  archived: "neutral",
} as const satisfies Record<PropertyStatus, string>;

export const LEAD_STATUS_TONES = {
  new: "accent",
  in_progress: "warn",
  handled: "neutral",
} as const satisfies Record<"new" | "in_progress" | "handled", string>;
