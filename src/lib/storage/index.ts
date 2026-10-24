import "server-only";
import { createCloudinaryStorage } from "./cloudinary";
import { createLocalStorage } from "./local";
import type { ImageStorage } from "./types";

let storage: ImageStorage | undefined;

/** Cloudinary when its three env vars are set, local files otherwise (development only). */
export function getStorage(): ImageStorage {
  if (storage) return storage;

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    storage = createCloudinaryStorage({
      cloudName: CLOUDINARY_CLOUD_NAME,
      apiKey: CLOUDINARY_API_KEY,
      apiSecret: CLOUDINARY_API_SECRET,
    });
  } else if (process.env.VERCEL) {
    throw new Error(
      "Photo storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
    );
  } else {
    storage = createLocalStorage();
  }
  return storage;
}

export type { ImageStorage, StoredImage } from "./types";
