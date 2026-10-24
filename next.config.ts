import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // The app has two root layouts (public site and back office); this renders 404s for URLs
    // that match neither. See src/app/global-not-found.tsx.
    globalNotFound: true,
    serverActions: {
      // Photos are resized in the browser first (2000 px WebP, usually under 1 MB);
      // the server rejects anything over 2.5 MB, plus some room for multipart overhead.
      bodySizeLimit: "3mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
