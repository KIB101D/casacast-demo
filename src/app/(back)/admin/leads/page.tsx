import Link from "next/link";
import { Suspense } from "react";
import { Notice, PageHeader, Skeleton } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { LEAD_STATUS_TONES } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { adminTitle, getAdminI18n } from "@/i18n/admin/server";
import {
  countLeadsByStatus,
  countMessages,
  isLeadStatus,
  listLeads,
  type LeadStatus,
} from "@/lib/leads/queries";
import { setLeadStatus } from "./actions";
import { InboxPoller } from "./inbox-poller";

export const generateMetadata = adminTitle("enquiries");

const TABS = [
  { status: "new", key: "new" },
  { status: "in_progress", key: "in_progress" },
  { status: "handled", key: "handled" },
  { status: undefined, key: "all" },
] as const;

export default async function LeadsPage({ searchParams }: PageProps<"/admin/leads">) {
  const { t } = await getAdminI18n();
  return (
    <>
      <PageHeader title={t.meta.enquiries} description={t.leads.description} />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Leads searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function Leads({
  searchParams,
}: {
  searchParams: PageProps<"/admin/leads">["searchParams"];
}) {
  const [user, params, { t, format }] = await Promise.all([
    requireUser(),
    searchParams,
    getAdminI18n(),
  ]);
  const requested = one(params.status);
  const status: LeadStatus | undefined = isLeadStatus(requested) ? requested : undefined;
  const propertyId = one(params.property);

  const [rows, counts] = await Promise.all([
    listLeads(user, { status, propertyId }),
    countLeadsByStatus(user, propertyId),
  ]);
  const threads = await countMessages(rows.map((r) => r.id));
  const href = (s: LeadStatus | undefined) => {
    const query = new URLSearchParams();
    if (s) query.set("status", s);
    if (propertyId) query.set("property", propertyId);
    const qs = query.toString();
    return `/admin/leads${qs ? `?${qs}` : ""}`;
  };
  const countFor = (s: LeadStatus | undefined) =>
    s ? counts[s] : counts.new + counts.in_progress + counts.handled;

  return (
    <>
      <InboxPoller intervalMs={30_000} />
      {user.role === "demo" ? <Notice tone="warn">{t.leads.demoNotice}</Notice> : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label={t.leads.filterLabel}
          className="border-line bg-surface flex rounded-lg border p-1"
        >
          {TABS.map((tab) => {
            const active = tab.status === status;
            return (
              <Link
                key={tab.key}
                href={href(tab.status)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-accent-soft text-accent-strong font-medium"
                    : "text-muted hover:text-ink",
                )}
              >
                {t.leads.tabs[tab.key]} <span className="tabular-nums">{countFor(tab.status)}</span>
              </Link>
            );
          })}
        </nav>
        {propertyId ? (
          <p className="text-muted text-sm">
            {t.leads.oneListing} ·{" "}
            <Link
              href={status ? `/admin/leads?status=${status}` : "/admin/leads"}
              className="text-accent hover:underline"
            >
              {t.leads.showAll}
            </Link>
          </p>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="border-line bg-surface rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">{status === "new" ? t.leads.emptyNew : t.leads.emptyAny}</p>
          <p className="text-muted mt-1 text-sm">{t.leads.emptyText}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((lead) => (
            <li
              key={lead.id}
              className={cn(
                "border-line bg-surface rounded-xl border p-4 sm:p-5",
                lead.status === "new" && "border-l-accent border-l-4",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/admin/leads/${lead.id}`} className="hover:text-accent font-medium">
                    {lead.name}
                  </Link>
                  <p className="text-muted mt-0.5 flex flex-wrap gap-x-3 text-sm">
                    <a href={`mailto:${lead.email}`} className="hover:text-accent hover:underline">
                      {lead.email}
                    </a>
                    {lead.phone ? (
                      <a
                        href={`tel:${lead.phone.replace(/\s/g, "")}`}
                        className="hover:text-accent hover:underline"
                      >
                        {lead.phone}
                      </a>
                    ) : null}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted text-xs tabular-nums">
                    {format.dateTime(lead.createdAt)}
                  </span>
                  <Badge tone={LEAD_STATUS_TONES[lead.status]}>{t.leads.status[lead.status]}</Badge>
                </div>
              </div>

              <p className="text-muted mt-3 text-xs">
                {lead.listing ? (
                  <>
                    {t.leads.about}{" "}
                    <Link
                      href={`/admin/properties/${lead.listing.id}`}
                      className="text-ink hover:text-accent"
                    >
                      <span className="font-mono">{lead.listing.reference}</span>{" "}
                      {lead.listing.title}
                    </Link>
                  </>
                ) : (
                  t.leads.general
                )}
              </p>
              <p className="mt-2 line-clamp-4 text-sm leading-relaxed wrap-anywhere whitespace-pre-line">
                {lead.message}
              </p>
              {threads.get(lead.id) ? (
                <p className="text-muted mt-2 text-xs">
                  <Link href={`/admin/leads/${lead.id}`} className="hover:text-accent">
                    {t.leads.emails(threads.get(lead.id)!.total)}
                  </Link>
                  {threads.get(lead.id)!.lastInbound ? (
                    <Badge tone="accent">
                      {t.leads.clientReplied(format.dateTime(threads.get(lead.id)!.lastInbound!))}
                    </Badge>
                  ) : null}
                </p>
              ) : null}

              <form
                action={setLeadStatus.bind(
                  null,
                  lead.id,
                  lead.status === "handled" ? "in_progress" : "handled",
                )}
                className="mt-4 flex flex-wrap gap-2"
              >
                {lead.status !== "handled" ? (
                  <>
                    <Button type="submit" variant="secondary" className="px-3 py-1.5">
                      {t.leads.markHandled}
                    </Button>
                    <Link
                      href={`/admin/leads/${lead.id}`}
                      className="text-accent self-center px-2 text-sm hover:underline"
                    >
                      {t.leads.reply}
                    </Link>
                  </>
                ) : (
                  <Button type="submit" variant="ghost" className="px-3 py-1.5">
                    {t.leads.reopen}
                  </Button>
                )}
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
