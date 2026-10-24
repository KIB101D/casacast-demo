import { revalidateTag } from "next/cache";
import { resetDemo } from "@/demo/reset";
import { LISTINGS_TAG } from "@/lib/catalog/queries";

/**
 * Demo version: the nightly reset (vercel.json schedules it). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; without the secret set, the route is closed.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const removed = await resetDemo();
  revalidateTag(LISTINGS_TAG, "max");
  return Response.json({ ok: true, removed });
}
