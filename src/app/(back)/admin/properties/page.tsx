import Link from "next/link";
import { Suspense } from "react";
import { Notice, PageHeader, Skeleton } from "@/components/admin/page-header";
import { PhotoImage } from "@/components/photo-image";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { adminTitle, getAdminI18n } from "@/i18n/admin/server";
import { STATUS_TONES } from "@/lib/labels";
import { LIMITS, remainingQuota } from "@/lib/permissions";
import { countPropertiesCreatedBy, listProperties } from "@/lib/properties/queries";

export const generateMetadata = adminTitle("listings");

export default async function PropertiesPage({ searchParams }: PageProps<"/admin/properties">) {
  const { t } = await getAdminI18n();
  return (
    <>
      <PageHeader
        title={t.meta.listings}
        description={t.listings.description}
        actions={<ButtonLink href="/admin/properties/new">{t.listings.newListing}</ButtonLink>}
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <PropertiesTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function PropertiesTable({
  searchParams,
}: {
  searchParams: PageProps<"/admin/properties">["searchParams"];
}) {
  const user = await requireUser();
  const [rows, ownCount, params, { t, format }] = await Promise.all([
    listProperties(user),
    countPropertiesCreatedBy(user.id),
    searchParams,
    getAdminI18n(),
  ]);

  return (
    <>
      {params.deleted ? <Notice tone="ok">{t.listings.deleted}</Notice> : null}
      {user.role === "demo" ? (
        <Notice tone="warn">
          {t.listings.demoQuota(
            ownCount,
            LIMITS.demo.createProperty,
            remainingQuota("demo", "createProperty", ownCount),
          )}
        </Notice>
      ) : null}

      {rows.length === 0 ? (
        <div className="border-line bg-surface rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">{t.listings.emptyTitle}</p>
          <p className="text-muted mt-1 text-sm">{t.listings.emptyText}</p>
        </div>
      ) : (
        <div className="border-line bg-surface overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="border-line text-muted border-b text-xs">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t.listings.columns.listing}
                </th>
                <th scope="col" className="hidden px-4 py-3 font-medium sm:table-cell">
                  {t.listings.columns.type}
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  {t.listings.columns.price}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t.listings.columns.status}
                </th>
                <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">
                  {t.listings.columns.updated}
                </th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-canvas transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-canvas border-line relative hidden h-12 w-16 shrink-0 overflow-hidden rounded-md border sm:block">
                        {row.coverUrl ? (
                          <PhotoImage
                            src={row.coverUrl}
                            alt=""
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="text-muted flex h-full items-center justify-center text-[10px]">
                            {t.listings.noPhoto}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/admin/properties/${row.id}`}
                          className="text-ink hover:text-accent font-medium"
                        >
                          {row.title}
                        </Link>
                        <div className="text-muted mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                          <span className="font-mono whitespace-nowrap">{row.reference}</span>
                          <span aria-hidden>·</span>
                          <span>{row.town}</span>
                          {row.createdById === user.id && user.role === "demo" ? (
                            <Badge tone="warn">{t.listings.yours}</Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="text-muted hidden px-4 py-3 sm:table-cell">
                    {t.labels.types[row.type]}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {format.price(row.price, row.operation)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONES[row.status]}>{t.labels.statuses[row.status]}</Badge>
                  </td>
                  <td className="text-muted hidden px-4 py-3 tabular-nums lg:table-cell">
                    {format.dateTime(row.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
