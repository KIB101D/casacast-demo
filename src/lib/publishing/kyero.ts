import type { Locale, PropertyType } from "@/db/schema";
import type { ListingSnapshot } from "./types";

/**
 * Kyero XML, version 3: the exchange format Spanish portals (Kyero, Idealista, Inmobalia, …) read
 * from an agency's public feed URL. The portal fetches the feed on its own schedule, so
 * "published" here means "in the feed", not "live on the portal".
 */

export const KYERO_MAX_IMAGES = 50;

/** Kyero takes descriptions in its own list of languages; Ukrainian is not among them. */
const KYERO_LANGUAGES = ["en", "es"] as const satisfies readonly Locale[];

const KYERO_TYPES: Record<PropertyType, string> = {
  flat: "apartment",
  chalet: "villa",
  bungalow: "bungalow",
  country_house: "country house",
  land: "land",
  shop: "commercial",
};

export function kyeroType(type: PropertyType) {
  return KYERO_TYPES[type];
}

/** Kyero's `<price>`: whole number, at most 8 digits. */
const MAX_PRICE = 99_999_999;
/** Kyero's limit for every URL in the feed. */
const MAX_URL = 255;

/**
 * The URL Kyero should fetch for a photo. Kyero only takes URLs ending in .jpg, .png or .gif (see
 * the XSD), while our uploads are WebP. Cloudinary converts on the fly when the extension changes,
 * so a Cloudinary photo is offered as .jpg. Other WebP files can't be offered: null.
 */
export function kyeroImageUrl(url: string): string | null {
  if (/\.(jpe?g|png|gif)$/i.test(url)) return url;
  if (url.includes("res.cloudinary.com") && url.includes("/image/upload/")) {
    return url.replace(/\.[a-z0-9]+$/i, ".jpg");
  }
  return null;
}

function kyeroImages(listing: ListingSnapshot) {
  return listing.photos
    .map(kyeroImageUrl)
    .filter((url): url is string => url !== null)
    .slice(0, KYERO_MAX_IMAGES);
}

/** Problems that would make a portal reject the listing. Empty means it can go in the feed. */
export function validateForKyero(listing: ListingSnapshot): string[] {
  const problems: string[] = [];
  if (listing.price <= 0) problems.push("a price above zero");
  if (listing.price > MAX_PRICE) problems.push("a price of at most 8 digits");
  if (!listing.town.trim()) problems.push("a town");
  if (!listing.province.trim()) problems.push("a province");
  if (listing.photos.length === 0) problems.push("at least one photo");
  else if (kyeroImages(listing).length === 0) {
    problems.push(
      "at least one photo it can read (JPG, PNG or GIF; WebP works through Cloudinary)",
    );
  }
  if (KYERO_LANGUAGES.some((locale) => listing.pageUrls[locale].length > MAX_URL)) {
    problems.push(`listing links of at most ${MAX_URL} characters`);
  }
  const hasKyeroText = listing.translations.some(
    (t) => (KYERO_LANGUAGES as readonly Locale[]).includes(t.locale) && t.description.trim(),
  );
  if (!hasKyeroText) problems.push("a description in English or Spanish");
  return problems;
}

export function kyeroProblemsMessage(problems: string[]) {
  return `Kyero needs ${problems.join(", ")}.`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** "2026-10-22 09:30:00", in UTC: the format the spec uses. */
export function kyeroDate(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Kyero has no title field, so the title opens the description. Line breaks must be written as
 * `&#13;` ("no HTML"); text is escaped, never wrapped in CDATA.
 */
function descriptionXml(title: string, description: string) {
  const text = `${title.trim()}\n\n${description.trim()}`.replace(/\r\n?/g, "\n");
  return escapeXml(text).replace(/\n/g, "&#13;");
}

function tag(name: string, value: string | number, indent: string) {
  return `${indent}<${name}>${escapeXml(String(value))}</${name}>`;
}

function propertyXml(listing: ListingSnapshot): string {
  const i = "    ";
  const ii = "      ";
  const texts = KYERO_LANGUAGES.map((locale) => ({
    locale,
    text: listing.translations.find((t) => t.locale === locale),
  })).filter((t) => t.text);

  const lines = [
    "  <property>",
    tag("id", listing.reference, i),
    tag("date", kyeroDate(listing.updatedAt), i),
    tag("ref", listing.reference, i),
    tag("price", listing.price, i),
    tag("currency", "EUR", i),
    tag("price_freq", listing.operation === "rent" ? "month" : "sale", i),
    tag("new_build", 0, i),
    tag("type", kyeroType(listing.type), i),
    tag("town", listing.town, i),
    tag("province", listing.province, i),
    tag("country", "Spain", i),
  ];
  if (listing.latitude !== null && listing.longitude !== null) {
    lines.push(
      `${i}<location>`,
      tag("latitude", listing.latitude, ii),
      tag("longitude", listing.longitude, ii),
      `${i}</location>`,
    );
  }
  lines.push(
    tag("beds", listing.bedrooms, i),
    tag("baths", listing.bathrooms, i),
    tag("pool", 0, i),
    `${i}<surface_area>`,
    // Land has no built area: its area is the plot. Houses send both when the plot is known.
    ...(listing.type === "land" ? [] : [tag("built", listing.area, ii)]),
    ...(listing.type === "land"
      ? [tag("plot", listing.area, ii)]
      : listing.plotArea
        ? [tag("plot", listing.plotArea, ii)]
        : []),
    `${i}</surface_area>`,
    `${i}<url>`,
    ...KYERO_LANGUAGES.map((locale) => tag(locale, listing.pageUrls[locale], ii)),
    `${i}</url>`,
    `${i}<desc>`,
    ...texts.map(
      ({ locale, text }) =>
        `${ii}<${locale}>${descriptionXml(text!.title, text!.description)}</${locale}>`,
    ),
    `${i}</desc>`,
    `${i}<images>`,
    ...kyeroImages(listing).map(
      (url, index) =>
        `${ii}<image id="${index + 1}">\n${ii}  <url>${escapeXml(url)}</url>\n${ii}</image>`,
    ),
    `${i}</images>`,
    "  </property>",
  );
  return lines.join("\n");
}

/**
 * The whole feed. Kyero feeds are absolute: a listing missing from it is deleted on the portal.
 * The XSD requires at least one <property>, so an empty feed (nothing published) fails its schema;
 * an agency always has listings, and serving it anyway still tells portals to drop what they had.
 */
export function buildKyeroFeed(listings: ListingSnapshot[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<root>",
    "  <kyero>",
    "    <feed_version>3</feed_version>",
    "  </kyero>",
    ...listings.map(propertyXml),
    "</root>",
    "",
  ].join("\n");
}
