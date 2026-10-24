import { revalidateTag } from "next/cache";
import { LISTINGS_TAG } from "@/lib/catalog/queries";
import { syncInbox } from "@/lib/mail/sync";
import { drainQueue } from "@/lib/publishing/queue";

/**
 * Scheduled worker tick (Vercel Cron, or any scheduler) for work that otherwise runs while the back
 * office is open: due publishing syncs (retries included) and new replies in the agency inbox.
 * Vercel sends `Authorization: Bearer $CRON_SECRET`; without the secret set, the route is closed.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const [touched, inbox] = await Promise.all([drainQueue({ budgetMs: 45_000 }), syncInbox()]);
  if (touched.has("site") || touched.has("kyero")) revalidateTag(LISTINGS_TAG, "max");
  return Response.json({ ok: true, publishing: [...touched], inbox });
}
