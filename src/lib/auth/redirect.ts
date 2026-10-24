/**
 * Where to send the user after login. Only same-site paths under /admin are allowed,
 * so a crafted `?next=https://evil.example` link can't turn login into an open redirect.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string") return "/admin";
  if (!next.startsWith("/admin")) return "/admin";
  if (next.startsWith("//") || next.includes("\\")) return "/admin";
  return next;
}
