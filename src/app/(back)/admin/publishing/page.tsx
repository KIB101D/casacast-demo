import Link from "next/link";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { cn } from "@/lib/cn";
import { adminTitle, getAdminI18n } from "@/i18n/admin/server";
import { listChannelSummaries, listRecentActivity } from "@/lib/publishing/views";
import { runQueueNow } from "./actions";

export const generateMetadata = adminTitle("publishing");

export default async function PublishingPage() {
  const { t } = await getAdminI18n();
  return (
    <>
      <PageHeader
        title={t.meta.publishing}
        description={t.publishingPage.description}
        actions={
          <form action={runQueueNow}>
            <Button type="submit" variant="secondary">
              {t.publishingPage.runQueue}
            </Button>
          </form>
        }
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Overview />
      </Suspense>
    </>
  );
}

async function Overview() {
  const [user, { t, format }] = await Promise.all([requireUser(), getAdminI18n()]);
  const [channels, activity] = await Promise.all([
    listChannelSummaries(user),
    listRecentActivity(user),
  ]);
  const p = t.publishingPage;

  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {channels.map((channel) => (
          <li key={channel.type} className="border-line bg-surface rounded-xl border p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{t.labels.channels[channel.type]}</h2>
              {channel.enabled ? null : <Badge>{p.off}</Badge>}
            </div>
            <p className="text-muted mt-1 text-xs">{p.how[channel.type]}</p>
            <dl className="mt-4 flex gap-4 text-sm">
              {(
                [
                  ["published", p.live, "text-ok"],
                  ["queued", p.queued, "text-accent"],
                  ["failed", p.failed, "text-danger"],
                ] as const
              ).map(([status, label, color]) => (
                <div key={status}>
                  <dt className="text-muted text-xs">{label}</dt>
                  <dd
                    className={cn(
                      "text-xl font-semibold tabular-nums",
                      channel.counts[status] ? color : "text-muted",
                    )}
                  >
                    {channel.counts[status] ?? 0}
                  </dd>
                </div>
              ))}
            </dl>
            {channel.type === "kyero" ? (
              <a
                href="/feeds/kyero.xml"
                target="_blank"
                className="text-accent mt-3 inline-block text-sm underline-offset-4 hover:underline"
              >
                {p.openFeed}
              </a>
            ) : null}
          </li>
        ))}
      </ul>

      <section aria-labelledby="activity-heading" className="mt-8">
        <h2 id="activity-heading" className="mb-3 text-base font-semibold">
          {p.activity}
        </h2>
        {activity.length === 0 ? (
          <p className="text-muted text-sm">{p.noActivity}</p>
        ) : (
          <div className="border-line bg-surface overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="text-muted border-line border-b text-xs">
                <tr>
                  <th className="px-4 py-2 font-medium">{t.panel.columns.when}</th>
                  <th className="px-4 py-2 font-medium">{p.listing}</th>
                  <th className="px-4 py-2 font-medium">{t.panel.columns.channel}</th>
                  <th className="px-4 py-2 font-medium">{t.panel.columns.action}</th>
                  <th className="px-4 py-2 font-medium">{t.panel.columns.result}</th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {activity.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                      {format.dateTime(item.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/admin/properties/${item.propertyId}`}
                        className="hover:text-accent underline-offset-4 hover:underline"
                      >
                        <span className="font-mono text-xs">{item.reference}</span>{" "}
                        <span className="text-muted">{item.title}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {t.labels.channels[item.channelType]}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {t.panel.actions[item.action]}
                      {item.attempt > 1 ? (
                        <span className="text-muted">{t.panel.attempt(item.attempt)}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex flex-col gap-1">
                        <span>
                          <Badge tone={item.result === "success" ? "ok" : "danger"}>
                            {item.result === "success" ? t.common.ok : t.common.error}
                          </Badge>
                        </span>
                        <span className={cn("text-xs", item.error ? "text-danger" : "text-muted")}>
                          {item.error ?? item.detail}
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
