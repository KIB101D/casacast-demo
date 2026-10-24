import { NextResponse, type NextRequest } from "next/server";
import { negotiateLocale } from "@/i18n/config";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/token";

/**
 * Optimistic routing only: reads the cookie and headers, never the database.
 * Real authorization happens in the Data Access Layer (src/lib/auth/dal.ts).
 */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The site lives under /es, /en and /uk; the bare domain goes to the visitor's language.
  if (pathname === "/") {
    const locale = negotiateLocale(request.headers.get("accept-language"));
    return NextResponse.redirect(new URL(`/${locale}`, request.nextUrl));
  }

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/admin") && !session) {
    const url = new URL("/login", request.nextUrl);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Demo version: no "/login → /admin" shortcut for a signed cookie. Sandboxes are deleted every
  // night, and a cookie that still verifies but points at a deleted user would bounce between the
  // two pages forever. "Try the demo" reuses a live sandbox, so nobody gets a second one.

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin/:path*"],
};
