import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Notice, PageHeader, Skeleton } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminI18n } from "@/i18n/admin";
import { adminTitle, getAdminI18n } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/dal";
import { LEAD_STATUS_TONES } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { getLeadConversation, type ConversationMessage } from "@/lib/leads/queries";
import { mailConfig } from "@/lib/mail/transport";
import { setLeadStatus } from "../actions";
import { InboxPoller } from "../inbox-poller";
import { retryReply } from "./actions";
import { ReplyForm } from "./reply-form";

export const generateMetadata = adminTitle("enquiry");

export default function LeadPage(props: PageProps<"/admin/leads/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[480px]" />}>
      <Conversation {...props} />
    </Suspense>
  );
}

function statusNote(t: AdminI18n["t"], status: ConversationMessage["status"]) {
  return status === "received" ? null : t.conversation.notes[status];
}

async function Conversation({ params }: PageProps<"/admin/leads/[id]">) {
  const [{ id }, user, i18n] = await Promise.all([params, requireUser(), getAdminI18n()]);
  const { t } = i18n;
  const conversation = await getLeadConversation(user, id);
  if (!conversation) notFound();
  const { lead, messages } = conversation;
  const config = mailConfig();
  const demo = user.role === "demo";

  return (
    <>
      <InboxPoller intervalMs={15_000} />
      <PageHeader
        title={lead.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <a href={`mailto:${lead.email}`} className="hover:text-accent hover:underline">
              {lead.email}
            </a>
            {lead.phone ? <span>{lead.phone}</span> : null}
            <Badge tone={LEAD_STATUS_TONES[lead.status]}>{t.leads.status[lead.status]}</Badge>
          </span>
        }
        actions={
          <form
            action={setLeadStatus.bind(
              null,
              lead.id,
              lead.status === "handled" ? "in_progress" : "handled",
            )}
          >
            <Button type="submit" variant="secondary">
              {lead.status === "handled" ? t.leads.reopen : t.leads.markHandled}
            </Button>
          </form>
        }
      />

      <p className="text-muted mb-4 text-sm">
        <Link href="/admin/leads" className="hover:text-accent">
          {t.conversation.back}
        </Link>
        <span aria-hidden> · </span>
        {lead.listing ? (
          <>
            {t.leads.about}{" "}
            <Link
              href={`/admin/properties/${lead.listing.id}`}
              className="text-ink hover:text-accent"
            >
              <span className="font-mono">{lead.listing.reference}</span> {lead.listing.title}
            </Link>
          </>
        ) : (
          t.leads.general
        )}
      </p>

      {!demo && !config ? <Notice tone="warn">{t.conversation.mailMissing}</Notice> : null}

      <ol aria-label={t.conversation.label} className="flex max-w-3xl flex-col gap-3">
        <Bubble
          inbound
          author={lead.name}
          date={i18n.format.dateTime(lead.createdAt)}
          note={t.conversation.fromForm}
        >
          {lead.message}
        </Bubble>
        {messages.map((m) => (
          <Bubble
            key={m.id}
            inbound={m.direction === "inbound"}
            author={m.direction === "inbound" ? lead.name : t.conversation.you}
            date={i18n.format.dateTime(m.createdAt)}
            note={statusNote(t, m.status)}
            failed={m.status === "failed" ? m.error : undefined}
            retry={
              m.status === "failed" && !demo ? (
                <form action={retryReply.bind(null, lead.id, m.id)}>
                  <Button type="submit" variant="secondary" className="px-3 py-1 text-xs">
                    {t.common.retry}
                  </Button>
                </form>
              ) : null
            }
          >
            {m.body}
          </Bubble>
        ))}
      </ol>

      <section className="border-line bg-surface mt-6 max-w-3xl rounded-xl border p-5">
        <ReplyForm
          leadId={lead.id}
          to={lead.email}
          from={demo ? null : (config?.address ?? null)}
          disabledReason={!demo && !config ? t.conversation.setUpEmail : undefined}
        />
      </section>
    </>
  );
}

function Bubble({
  inbound,
  author,
  date,
  note,
  failed,
  retry,
  children,
}: {
  inbound: boolean;
  author: string;
  date: string;
  note?: string | null;
  failed?: string | null;
  retry?: React.ReactNode;
  children: string;
}) {
  return (
    <li className={cn("flex", inbound ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[85%] min-w-0 rounded-xl border px-4 py-3",
          inbound ? "border-line bg-surface" : "border-accent/20 bg-accent-soft",
          failed !== undefined && "border-danger/40",
        )}
      >
        <p className="text-muted flex flex-wrap items-center gap-x-2 text-xs">
          <span className="text-ink font-medium">{author}</span>
          <span className="tabular-nums">{date}</span>
          {note ? <span>· {note}</span> : null}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed wrap-anywhere whitespace-pre-line">
          {children}
        </p>
        {failed !== undefined ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-danger text-xs wrap-anywhere">{failed}</p>
            {retry}
          </div>
        ) : null}
      </div>
    </li>
  );
}
