import { propertyType, type PropertyType } from "@/db/schema";

export const SORTS = ["newest", "price-asc", "price-desc"] as const;
export type Sort = (typeof SORTS)[number];

export const BEDROOM_OPTIONS = [1, 2, 3, 4] as const;

export type CatalogFilters = {
  operation?: "sale" | "rent";
  type?: PropertyType;
  town?: string;
  maxPrice?: number;
  minBedrooms?: number;
  sort: Sort;
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v?.trim();
  return trimmed ? trimmed : undefined;
}

function positiveInt(value: string | undefined, max: number): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const n = Number.parseInt(value, 10);
  return n > 0 && n <= max ? n : undefined;
}

/**
 * Turns the URL query into filters. Anything unknown or malformed is dropped rather than
 * rejected: a hand-edited or outdated link still shows homes instead of an error.
 */
export function parseFilters(params: SearchParams): CatalogFilters {
  const operation = first(params.operation);
  const type = first(params.type);
  const sort = first(params.sort);

  return {
    operation: operation === "sale" || operation === "rent" ? operation : undefined,
    type: (propertyType.enumValues as readonly string[]).includes(type ?? "")
      ? (type as PropertyType)
      : undefined,
    town: first(params.town)?.slice(0, 80),
    maxPrice: positiveInt(first(params.maxPrice)?.replace(/[\s.,]/g, ""), 100_000_000),
    minBedrooms: positiveInt(first(params.bedrooms), 20),
    sort: (SORTS as readonly string[]).includes(sort ?? "") ? (sort as Sort) : "newest",
  };
}

/** The query string for a set of filters, leaving out defaults so URLs stay short and shareable. */
export function filtersToQuery(filters: Partial<CatalogFilters>): string {
  const query = new URLSearchParams();
  if (filters.operation) query.set("operation", filters.operation);
  if (filters.type) query.set("type", filters.type);
  if (filters.town) query.set("town", filters.town);
  if (filters.maxPrice) query.set("maxPrice", String(filters.maxPrice));
  if (filters.minBedrooms) query.set("bedrooms", String(filters.minBedrooms));
  if (filters.sort && filters.sort !== "newest") query.set("sort", filters.sort);
  const text = query.toString();
  return text ? `?${text}` : "";
}

export function hasActiveFilters(filters: CatalogFilters) {
  return Boolean(
    filters.operation || filters.type || filters.town || filters.maxPrice || filters.minBedrooms,
  );
}
