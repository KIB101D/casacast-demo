import { eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/db";
import { demoPhotoBlobs } from "@/demo/schema";

/**
 * Serves photos uploaded in the demo (src/demo/storage.ts). Ids are random UUIDs and blobs never
 * change, so responses can be cached; they are only linked from pages their author can see.
 */
export async function GET(_request: Request, ctx: RouteContext<"/demo-photos/[file]">) {
  const { file } = await ctx.params;
  const id = file.replace(/\.jpg$/, "");
  if (!z.uuid().safeParse(id).success) return new Response("Not found", { status: 404 });

  const [blob] = await db
    .select({ data: demoPhotoBlobs.data, contentType: demoPhotoBlobs.contentType })
    .from(demoPhotoBlobs)
    .where(eq(demoPhotoBlobs.id, id));
  if (!blob) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(blob.data), {
    headers: {
      "content-type": blob.contentType,
      "cache-control": "public, max-age=86400, immutable",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex",
    },
  });
}
