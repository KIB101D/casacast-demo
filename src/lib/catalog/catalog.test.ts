import { describe, expect, it } from "vitest";
import { negotiateLocale, plural } from "@/i18n/config";
import { en } from "@/i18n/dictionaries/en";
import { es } from "@/i18n/dictionaries/es";
import { fill } from "@/i18n/dictionaries/index";
import { uk } from "@/i18n/dictionaries/uk";
import { formatArea, formatEuros } from "@/i18n/format";
import { filtersToQuery, hasActiveFilters, parseFilters } from "./filters";
import { listingSlug, referenceFromSlug, slugify } from "./slug";

describe("parseFilters", () => {
  it("reads a full query", () => {
    expect(
      parseFilters({
        operation: "rent",
        type: "flat",
        town: "Alicante",
        maxPrice: "1200",
        bedrooms: "2",
        sort: "price-asc",
      }),
    ).toEqual({
      operation: "rent",
      type: "flat",
      town: "Alicante",
      maxPrice: 1200,
      minBedrooms: 2,
      sort: "price-asc",
    });
  });

  it("drops unknown and malformed values instead of failing", () => {
    expect(
      parseFilters({
        operation: "steal",
        type: "castle",
        maxPrice: "-5",
        bedrooms: "two",
        sort: "random",
      }),
    ).toEqual({ sort: "newest" });
  });

  it("accepts prices typed with thousands separators", () => {
    expect(parseFilters({ maxPrice: "250.000" }).maxPrice).toBe(250000);
    expect(parseFilters({ maxPrice: "250 000" }).maxPrice).toBe(250000);
  });

  it("uses the first value when a parameter repeats", () => {
    expect(parseFilters({ operation: ["sale", "rent"] }).operation).toBe("sale");
  });

  it("ignores empty fields from a submitted form", () => {
    expect(parseFilters({ town: "", maxPrice: "", bedrooms: "" })).toEqual({ sort: "newest" });
  });
});

describe("filtersToQuery", () => {
  it("round-trips through parseFilters", () => {
    const filters = parseFilters({ operation: "sale", town: "Jávea", maxPrice: "600000" });
    const query = new URLSearchParams(filtersToQuery(filters));
    expect(parseFilters(Object.fromEntries(query))).toEqual(filters);
  });

  it("leaves out defaults", () => {
    expect(filtersToQuery({ sort: "newest" })).toBe("");
  });
});

describe("hasActiveFilters", () => {
  it("does not count sorting as a filter", () => {
    expect(hasActiveFilters(parseFilters({ sort: "price-desc" }))).toBe(false);
    expect(hasActiveFilters(parseFilters({ bedrooms: "3" }))).toBe(true);
  });
});

describe("slugs", () => {
  it("strips accents and punctuation", () => {
    expect(slugify("Ático con terraza de 60 m² frente al mar")).toBe(
      "atico-con-terraza-de-60-m2-frente-al-mar",
    );
  });

  it("cuts long titles at a word boundary", () => {
    const slug = slugify("word ".repeat(40));
    expect(slug.length).toBeLessThanOrEqual(70);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("builds a URL from the reference and the title", () => {
    expect(listingSlug("CB-0006", "Seafront penthouse")).toBe("cb-0006-seafront-penthouse");
  });

  it("falls back to the reference for titles with no Latin letters", () => {
    expect(listingSlug("CB-0006", "Пентхаус")).toBe("cb-0006");
  });

  it("reads the reference back from any slug", () => {
    expect(referenceFromSlug("cb-0006-seafront-penthouse")).toBe("CB-0006");
    expect(referenceFromSlug("cb-0006")).toBe("CB-0006");
    expect(referenceFromSlug("CB-12345-old-title")).toBe("CB-12345");
  });

  it("rejects slugs without a reference", () => {
    expect(referenceFromSlug("seafront-penthouse")).toBeNull();
    expect(referenceFromSlug("cb-12")).toBeNull();
    expect(referenceFromSlug("cb-0006x")).toBeNull();
  });
});

describe("negotiateLocale", () => {
  it.each([
    ["uk-UA,uk;q=0.9,en;q=0.8", "uk"],
    ["en-US,en;q=0.9", "en"],
    ["de-DE,de;q=0.9,es;q=0.5", "es"],
    ["fr-FR, en;q=0.3", "en"],
    ["en;q=0.2, uk;q=0.8", "uk"],
    ["", "es"],
    [null, "es"],
  ])("%s → %s", (header, expected) => {
    expect(negotiateLocale(header)).toBe(expected);
  });
});

describe("plural", () => {
  it("uses the three Ukrainian forms", () => {
    expect(plural("uk", 1, uk.card.bedrooms)).toBe("1 спальня");
    expect(plural("uk", 3, uk.card.bedrooms)).toBe("3 спальні");
    expect(plural("uk", 5, uk.card.bedrooms)).toBe("5 спалень");
    expect(plural("uk", 21, uk.card.bedrooms)).toBe("21 спальня");
  });

  it("handles English and Spanish", () => {
    expect(plural("en", 1, en.results.count)).toBe("1 home");
    expect(plural("en", 14, en.results.count)).toBe("14 homes");
    expect(plural("es", 2, es.card.bathrooms)).toBe("2 baños");
  });
});

describe("formatting", () => {
  it("writes euros the local way", () => {
    expect(formatEuros(189000, "en")).toBe("€189,000");
    expect(formatEuros(189000, "es")).toMatch(/^189\.000\s€$/);
    expect(formatEuros(189000, "uk")).toMatch(/^189\s000\s€$/);
  });

  it("formats area", () => {
    expect(formatArea(1200, "en")).toBe("1,200 m²");
  });

  it("fills placeholders and keeps unknown ones", () => {
    expect(fill("Photo {current} of {total}", { current: 2, total: 9 })).toBe("Photo 2 of 9");
    expect(fill("Hi {name}", {})).toBe("Hi {name}");
  });
});
