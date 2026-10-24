/**
 * Absolute base URL for canonical links, hreflang, Open Graph and the sitemap.
 * Set SITE_URL explicitly for a custom domain; on Vercel the production URL is used automatically.
 */
export function siteUrl(): URL {
  const explicit = process.env.SITE_URL;
  if (explicit) return new URL(explicit);

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);

  return new URL("http://localhost:3000");
}
