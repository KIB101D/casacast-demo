import { kyeroFeedXml } from "@/lib/publishing/feed";

/** Public Kyero XML v3 feed. Portals are given this URL and fetch it on their own schedule. */
export async function GET() {
  return new Response(await kyeroFeedXml(), {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
