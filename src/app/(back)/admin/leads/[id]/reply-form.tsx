"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useAdminI18n } from "@/i18n/admin/client";
import { sendReply, type ReplyState } from "./actions";

export function ReplyForm({
  leadId,
  to,
  from,
  disabledReason,
}: {
  leadId: string;
  to: string;
  /** The agency address, or null in the demo (nothing is sent). */
  from: string | null;
  disabledReason?: string;
}) {
  const [state, action, pending] = useActionState<ReplyState, FormData>(
    sendReply.bind(null, leadId),
    {},
  );
  const { t } = useAdminI18n();
  const c = t.conversation;

  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="reply-body" className="text-sm font-medium">
        {c.replyTo(to)}
      </label>
      {/* Remounted after each send, so the box is empty again. */}
      <textarea
        key={state.sent ?? 0}
        id="reply-body"
        name="body"
        rows={5}
        required
        maxLength={5000}
        disabled={Boolean(disabledReason) || pending}
        placeholder={c.placeholder}
        className="border-line bg-surface text-ink focus:border-accent focus:ring-accent/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none disabled:opacity-60"
      />
      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={Boolean(disabledReason) || pending}>
          {pending ? t.common.sending : from ? c.sendEmail : c.sendDemo}
        </Button>
        <span className="text-muted text-xs">
          {disabledReason ?? (from ? c.from(from) : c.demoNote)}
        </span>
      </div>
    </form>
  );
}
