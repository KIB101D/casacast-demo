import type { MetadataRoute } from "next";
import { LOCALES } from "@/i18n/config";
import { listForSitemap } from "@/lib/catalog/queries";
import { siteUrl } from "@/lib/site-url";

/** Every active listing in every language, each entry pointing at its translations. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const url = (path: string) => new URL(path, base).toString();
  const listings = await listForSitemap();

  const page = (path: string, priority: number) =>
    LOCALES.map((locale) => ({
      url: url(`/${locale}${path}`),
      changeFrequency: "daily" as const,
      priority,
      alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, url(`/${l}${path}`)])) },
    }));
  const home = [
    ...page("", 1),
    ...page("/homes", 0.9),
    ...page("/about", 0.5),
    ...page("/contact", 0.5),
  ];

  const homes = listings.flatMap((listing) =>
    LOCALES.map((locale) => ({
      url: url(`/${locale}/homes/${listing.slug}`),
      lastModified: listing.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
      alternates: {
        languages: Object.fromEntries(LOCALES.map((l) => [l, url(`/${l}/homes/${listing.slug}`)])),
      },
    })),
  );

  return [...home, ...homes];
}
