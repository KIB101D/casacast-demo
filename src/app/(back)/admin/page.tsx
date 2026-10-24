import Link from "next/link";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/admin/page-header";
import { ButtonLink } from "@/components/ui/button";
import { adminTitle, getAdminI18n } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/dal";
import { countLeadsByStatus } from "@/lib/leads/queries";
import { getDashboardCounts } from "@/lib/properties/queries";

export const generateMetadata = adminTitle("overview");

export default async function AdminHomePage() {
  const { t } = await getAdminI18n();
  return (
    <>
      <PageHeader
        title={t.meta.overview}
        description={t.dashboard.description}
        actions={<ButtonLink href="/admin/properties/new">{t.dashboard.newListing}</ButtonLink>}
      />
      <Suspense fallback={<Skeleton className="h-28" />}>
        <Stats />
      </Suspense>
    </>
  );
}

async function Stats() {
  const [user, { t }] = await Promise.all([requireUser(), getAdminI18n()]);
  const [counts, leadCounts] = await Promise.all([
    getDashboardCounts(user),
    countLeadsByStatus(user),
  ]);

  const cards = [
    { label: t.dashboard.active, value: counts.active, href: "/admin/properties" },
    { label: t.dashboard.drafts, value: counts.draft, href: "/admin/properties" },
    { label: t.dashboard.sold, value: counts.sold, href: "/admin/properties" },
    { label: t.dashboard.newEnquiries, value: leadCounts.new, href: "/admin/leads?status=new" },
    { label: t.dashboard.failedSyncs, value: counts.failedSyncs, href: "/admin/publishing" },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {cards.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className="border-line bg-surface hover:border-accent/40 rounded-xl border p-4 transition-colors"
        >
          <dt className="text-muted text-sm">{card.label}</dt>
          <dd className="mt-1 text-3xl font-semibold tabular-nums">{card.value}</dd>
        </Link>
      ))}
    </dl>
  );
}
