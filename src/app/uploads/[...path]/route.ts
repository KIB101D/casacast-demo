import { readLocalUpload } from "@/lib/storage/local";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Serves photos saved by the local storage fallback. Cloudinary photos never come through here. */
export async function GET(_request: Request, ctx: RouteContext<"/uploads/[...path]">) {
  const { path } = await ctx.params;
  const relative = path.join("/");
  const type = TYPES[relative.split(".").pop() ?? ""];
  const data = type ? await readLocalUpload(relative) : null;

  if (!data) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": type!,
      // File names are random UUIDs and never reused, so they can be cached forever.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
