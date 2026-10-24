"use client";

import Image, { type ImageLoader, type ImageProps } from "next/image";
import { photoUrl } from "@/lib/photos/url";

// Cloudinary resizes and converts on its side, so next/image only has to ask for the right width.
const loader: ImageLoader = ({ src, width, quality }) => photoUrl(src, { width, quality });

export function PhotoImage({ alt, ...props }: Omit<ImageProps, "loader">) {
  return <Image loader={loader} alt={alt} {...props} />;
}
