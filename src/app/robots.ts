import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/login", "/demo-photos/", "/feeds/kyero-preview.xml"],
    },
    sitemap: new URL("/sitemap.xml", siteUrl()).toString(),
  };
}
