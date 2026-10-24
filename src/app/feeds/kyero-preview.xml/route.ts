import { eq } from "drizzle-orm";
import { properties } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";
import { kyeroFeedWhere } from "@/lib/publishing/feed";

/**
 * Demo version: a sandbox's own listings in Kyero XML, built by the same code as the public feed
 * (/feeds/kyero.xml), which never contains them. Only the signed-in sandbox can open it.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });

  const xml = await kyeroFeedWhere(eq(properties.createdById, user.id));
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
    },
  });
}
