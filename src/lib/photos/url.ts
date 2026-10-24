/**
 * Builds a resized delivery URL. Cloudinary resizes and converts on the fly from URL parameters;
 * local development files are served as they are.
 */
export function photoUrl(
  url: string,
  { width, height, quality }: { width: number; height?: number; quality?: number },
): string {
  const marker = "/image/upload/";
  if (!url.includes("res.cloudinary.com") || !url.includes(marker)) {
    // Local files: the query string only keeps next/image's loader contract (it must use `width`).
    return `${url}?w=${width}`;
  }

  const transforms = [
    height ? "c_fill,g_auto" : "c_limit",
    `w_${width}`,
    height ? `h_${height}` : null,
    "f_auto",
    quality ? `q_${quality}` : "q_auto",
  ]
    .filter(Boolean)
    .join(",");

  return url.replace(marker, `${marker}${transforms}/`);
}
