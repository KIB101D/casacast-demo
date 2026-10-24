import "server-only";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import type { ImageStorage, StoredImage } from "./types";

export function createCloudinaryStorage(config: {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}): ImageStorage {
  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });

  return {
    name: "cloudinary",

    upload(data, { folder }) {
      return new Promise<StoredImage>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder, resource_type: "image", overwrite: false },
          (error, result?: UploadApiResponse) => {
            if (error || !result) {
              reject(new Error(error?.message ?? "Cloudinary returned no result."));
              return;
            }
            resolve({
              publicId: result.public_id,
              url: result.secure_url,
              width: result.width,
              height: result.height,
            });
          },
        );
        stream.end(data);
      });
    },

    async remove(publicId) {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
        invalidate: true,
      });
      // "not found" means it's already gone, which is what we wanted.
      if (result.result !== "ok" && result.result !== "not found") {
        throw new Error(`Cloudinary could not delete ${publicId}: ${result.result}`);
      }
    },
  };
}
