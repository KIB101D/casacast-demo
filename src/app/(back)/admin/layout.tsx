import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/admin/page-header";
import { AdminLanguageSwitcher } from "@/components/admin/language-switcher";
import { AdminI18nProvider } from "@/i18n/admin/client";
import { getAdminI18n } from "@/i18n/admin/server";
import { AGENCY_NAME } from "@/lib/constants";
import { AdminNav, AdminNavFallback } from "./admin-nav";
import { UserPanel } from "./user-panel";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  // The language comes from a cookie, so the whole shell renders per request.
  return (
    <Suspense fallback={<ShellFallback />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getAdminI18n();

  return (
    <AdminI18nProvider locale={locale}>
      <div lang={locale} className="flex min-h-screen flex-col md:flex-row">
        <aside className="border-line bg-surface flex shrink-0 flex-col gap-6 border-b px-4 py-5 md:w-60 md:border-r md:border-b-0">
          <div className="flex items-start justify-between gap-3 px-2">
            <Link href="/admin">
              <span className="text-accent block text-xs font-medium tracking-wide uppercase">
                {AGENCY_NAME}
              </span>
              <span className="text-muted text-sm">{t.shell.backOffice}</span>
            </Link>
            <AdminLanguageSwitcher className="md:hidden" />
          </div>
          <div className="flex flex-col gap-1">
            <Suspense fallback={<AdminNavFallback />}>
              <AdminNav />
            </Suspense>
            <div className="md:border-line md:mt-2 md:border-t md:pt-2">
              <a
                href={`/${locale}`}
                target="_blank"
                rel="noopener"
                className="text-muted hover:bg-canvas hover:text-ink flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
              >
                {t.shell.toSite}
                <svg
                  aria-hidden
                  viewBox="0 0 16 16"
                  className="size-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 3H3.5A.5.5 0 0 0 3 3.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V10M9 3h4v4M13 3 7.5 8.5" />
                </svg>
                <span className="sr-only">{t.shell.newTab}</span>
              </a>
            </div>
          </div>
          <div className="mt-auto">
            <Suspense fallback={<div className="h-16" />}>
              <UserPanel />
            </Suspense>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">{children}</main>
      </div>
    </AdminI18nProvider>
  );
}

function ShellFallback() {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-line bg-surface h-20 shrink-0 border-b md:h-auto md:w-60 md:border-r md:border-b-0" />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">
        <Skeleton className="mb-6 h-12 w-64" />
        <Skeleton className="h-96" />
      </main>
    </div>
  );
}
