/**
 * Listing URLs look like /en/homes/cb-0001-bright-flat-300-m-from-playa-del-cura.
 * The reference identifies the listing; the words after it are only for people and search engines,
 * so an old link keeps working after a title change and is redirected to the current one.
 */

const REFERENCE_PATTERN = /^([a-z]{2})-(\d{4,})(?:-|$)/i;

/** "Piso luminoso a 300 m de la playa del Cura" → "piso-luminoso-a-300-m-de-la-playa-del-cura". */
export function slugify(text: string, maxLength = 70): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // accents: á → a, ñ → n
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length <= maxLength) return slug;
  const cut = slug.slice(0, maxLength);
  const lastDash = cut.lastIndexOf("-");
  return lastDash > maxLength / 2 ? cut.slice(0, lastDash) : cut;
}

/** Reference + title words. Titles without Latin letters (e.g. Ukrainian) fall back to the reference alone. */
export function listingSlug(reference: string, title: string): string {
  const words = slugify(title);
  const ref = reference.toLowerCase();
  return words ? `${ref}-${words}` : ref;
}

/** "cb-0001-anything" → "CB-0001", or null when the URL doesn't start with a reference. */
export function referenceFromSlug(slug: string): string | null {
  const match = REFERENCE_PATTERN.exec(slug);
  return match ? `${match[1]!.toUpperCase()}-${match[2]}` : null;
}
