export type StoredImage = {
  /** Id the storage uses for later deletes. Cloudinary public id, or `local:<path>`. */
  publicId: string;
  /** Full-size delivery URL. */
  url: string;
  width: number;
  height: number;
};

export interface ImageStorage {
  readonly name: "cloudinary" | "local";
  upload(data: Buffer, options: { folder: string }): Promise<StoredImage>;
  remove(publicId: string): Promise<void>;
}
