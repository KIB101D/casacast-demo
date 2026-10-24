"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminI18n } from "@/i18n/admin/client";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/admin", key: "overview", exact: true },
  { href: "/admin/properties", key: "listings", exact: false },
  { href: "/admin/leads", key: "enquiries", exact: false },
  { href: "/admin/publishing", key: "publishing", exact: false },
] as const;

function NavList({ pathname }: { pathname: string | null }) {
  const { t } = useAdminI18n();
  return (
    <nav aria-label={t.shell.navLabel}>
      <ul className="flex gap-1 md:flex-col">
        {LINKS.map(({ href, key, exact }) => {
          const active =
            pathname !== null && (exact ? pathname === href : pathname.startsWith(href));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent-soft text-accent-strong font-medium"
                    : "text-muted hover:bg-canvas hover:text-ink",
                )}
              >
                {t.shell.nav[key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AdminNav() {
  return <NavList pathname={usePathname()} />;
}

/** Same links without the active state, shown while the pathname isn't known yet. */
export function AdminNavFallback() {
  return <NavList pathname={null} />;
}
