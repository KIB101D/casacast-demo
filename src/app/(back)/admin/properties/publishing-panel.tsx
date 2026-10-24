"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChannelType, PropertyStatus } from "@/db/schema";
import type { AdminDictionary } from "@/i18n/admin";
import { useAdminI18n } from "@/i18n/admin/client";
import { cn } from "@/lib/cn";
import { describePublication } from "@/lib/publishing/describe";
import type { PublishingPanelData } from "@/lib/publishing/views";
import {
  pollPublishing,
  publishNow,
  retrySync,
  saveChannels,
  type PublishingActionResult,
} from "./publishing-actions";

const POLL_MS = 2500;

type PanelStrings = AdminDictionary["panel"];

function channelHint(t: PanelStrings, type: ChannelType, demoListing: boolean) {
  if (type === "telegram") return demoListing ? t.hints.telegramDemo : t.hints.telegram;
  if (type === "kyero" && demoListing) return t.hints.kyeroDemo;
  return t.hints[type];
}

function linkLabel(t: PanelStrings, type: ChannelType) {
  return type === "kyero" ? t.links.kyero : type === "telegram" ? t.links.telegram : t.links.other;
}

/**
 * The listing's channels, their status and the sync log. The page gives it a `key` that changes
 * when the listing is saved, so it starts from fresh server data after every save.
 */
export function PublishingPanel({
  propertyId,
  propertyStatus,
  initial,
  editable,
  demoListing,
}: {
  propertyId: string;
  propertyStatus: PropertyStatus;
  initial: PublishingPanelData;
  editable: boolean;
  demoListing: boolean;
}) {
  const { t, format } = useAdminI18n();
  const [panel, setPanel] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => new Date());
  const [selected, setSelected] = useState(
    () => new Set(initial.publications.filter((p) => p.enabled).map((p) => p.id)),
  );

  const busy = panel.publications.some((p) => p.status === "queued" && p.channelEnabled);
  const dirty = panel.publications.some((p) => p.enabled !== selected.has(p.id));

  // While anything is queued, poll: each poll also runs the due syncs (see pollPublishing).
  useEffect(() => {
    if (!busy) return;
    const tick = setInterval(() => setNow(new Date()), 1000);
    const poll = setTimeout(async () => {
      const result = await pollPublishing(propertyId);
      setPanel(result.panel);
    }, POLL_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(poll);
    };
  }, [busy, panel, propertyId]);

  function apply(result: PublishingActionResult) {
    setPanel(result.panel);
    setError(result.ok ? null : result.error);
    setSelected(new Set(result.panel.publications.filter((p) => p.enabled).map((p) => p.id)));
  }

  function save() {
    startTransition(async () => apply(await saveChannels(propertyId, [...selected])));
  }

  return (
    <section
      aria-labelledby="publishing-heading"
      className="border-line bg-surface mb-6 flex max-w-3xl flex-col gap-4 rounded-xl border p-5"
    >
      <div>
        <h2 id="publishing-heading" className="text-base font-semibold">
          {t.panel.heading}
        </h2>
        <p className="text-muted mt-1 text-sm">{t.panel.intro}</p>
      </div>

      {propertyStatus === "draft" || propertyStatus === "archived" ? (
        <div className="border-warn/30 bg-warn-soft flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
          <p className="text-sm">
            <span className="font-medium">{t.panel.notLive[propertyStatus]}</span>{" "}
            <span className="text-muted">{t.panel.notLive.then}</span>
          </p>
          {editable ? (
            <Button
              type="button"
              disabled={pending}
              onClick={() => startTransition(async () => apply(await publishNow(propertyId)))}
            >
              {pending ? t.panel.publishing : t.panel.publishNow}
            </Button>
          ) : null}
        </div>
      ) : null}

      <ul className="divide-line border-line divide-y rounded-lg border">
        {panel.publications.map((p) => {
          const state = describePublication(p, propertyStatus, now, t);
          return (
            <li key={p.id} className="flex flex-col gap-1.5 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <label className="flex min-w-0 flex-1 items-start gap-3">
                  <input
                    type="checkbox"
                    className="accent-accent mt-1 size-4"
                    checked={selected.has(p.id)}
                    disabled={!editable || !p.channelEnabled || pending}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(p.id);
                      else next.delete(p.id);
                      setSelected(next);
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {t.labels.channels[p.channelType]}
                    </span>
                    <span className="text-muted block text-xs">
                      {channelHint(t.panel, p.channelType, demoListing)}
                    </span>
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  <span aria-live="polite">
                    <Badge tone={state.tone}>{state.label}</Badge>
                  </span>
                  {p.url && p.status !== "failed" ? (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent text-sm underline-offset-4 hover:underline"
                    >
                      {linkLabel(t.panel, p.channelType)}
                    </a>
                  ) : null}
                  {p.status === "failed" && editable ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="px-3 py-1"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => apply(await retrySync(propertyId, p.id)))
                      }
                    >
                      {t.common.retry}
                    </Button>
                  ) : null}
                </div>
              </div>
              {state.note || p.lastSyncedAt ? (
                <p
                  className={cn(
                    "pl-7 text-xs",
                    state.noteTone === "danger" ? "text-danger" : "text-muted",
                  )}
                >
                  {state.note ??
                    (p.lastSyncedAt ? t.panel.lastSynced(format.dateTime(p.lastSyncedAt)) : null)}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}

      {editable ? (
        <div className="flex items-center gap-3">
          <Button type="button" onClick={save} disabled={!dirty || pending}>
            {pending ? t.common.saving : t.panel.saveChannels}
          </Button>
          {dirty ? <span className="text-muted text-sm">{t.panel.unsaved}</span> : null}
        </div>
      ) : null}

      <details className="group">
        <summary className="text-muted hover:text-ink cursor-pointer text-sm">
          {t.panel.log(panel.logs.length)}
        </summary>
        {panel.logs.length === 0 ? (
          <p className="text-muted mt-3 text-sm">{t.panel.logEmpty}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">{t.panel.columns.when}</th>
                  <th className="py-1.5 pr-3 font-medium">{t.panel.columns.channel}</th>
                  <th className="py-1.5 pr-3 font-medium">{t.panel.columns.action}</th>
                  <th className="py-1.5 pr-3 font-medium">{t.panel.columns.result}</th>
                  <th className="py-1.5 font-medium">{t.panel.columns.details}</th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {panel.logs.map((log) => (
                  <tr key={log.id} className="align-top">
                    <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">
                      {format.dateTime(log.createdAt)}
                    </td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {t.labels.channels[log.channelType]}
                    </td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {t.panel.actions[log.action]}
                      {log.attempt > 1 ? t.panel.attempt(log.attempt) : ""}
                    </td>
                    <td className="py-1.5 pr-3">
                      <Badge tone={log.result === "success" ? "ok" : "danger"}>
                        {log.result === "success" ? t.common.ok : t.common.error}
                      </Badge>
                    </td>
                    <td
                      className={cn(
                        "py-1.5 wrap-anywhere",
                        log.error ? "text-danger" : "text-muted",
                      )}
                    >
                      {log.error ?? log.detail}
                      {log.durationMs !== null ? (
                        <span className="text-muted"> · {log.durationMs} ms</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </section>
  );
}
