"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import * as z from "zod";
import { db } from "@/db";
import { leadMessages } from "@/db/schema";
import { getAdminI18n } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/dal";
import { getLeadOwner } from "@/lib/leads/queries";
import { createReply, deliverReply, MailNotConfiguredError } from "@/lib/mail/replies";
import { syncInbox } from "@/lib/mail/sync";
import { canSeeLead } from "@/lib/permissions";

export type ReplyState = { error?: string; sent?: number };

async function authorize(leadId: string) {
  const user = await requireUser();
  const lead = await getLeadOwner(leadId);
  if (!lead || !canSeeLead(user, lead.ownerId, lead.visitorId))
    throw new Error("Enquiry not found.");
  return user;
}

export async function sendReply(
  leadId: string,
  prev: ReplyState,
  formData: FormData,
): Promise<ReplyState> {
  const [user, { t }] = await Promise.all([authorize(leadId), getAdminI18n()]);
  const replyBody = z
    .string()
    .trim()
    .min(1, t.conversation.writeFirst)
    .max(5000, t.conversation.tooLong);
  const parsed = replyBody.safeParse(formData.get("body") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  try {
    // The demo account is public: its replies are shown, never emailed.
    const simulate = user.role === "demo";
    const id = await createReply({ leadId, body: parsed.data, sentById: user.id, simulate });
    if (!simulate) await deliverReply(id);
  } catch (error) {
    if (error instanceof MailNotConfiguredError) return { error: t.conversation.notConfigured };
    throw error;
  }
  refresh();
  return { sent: (prev.sent ?? 0) + 1 };
}

export async function retryReply(leadId: string, messageId: string) {
  await authorize(leadId);
  const [message] = await db
    .select({ id: leadMessages.id })
    .from(leadMessages)
    .where(
      and(
        eq(leadMessages.id, messageId),
        eq(leadMessages.leadId, leadId),
        eq(leadMessages.status, "failed"),
      ),
    );
  if (message) {
    await db.update(leadMessages).set({ status: "sending" }).where(eq(leadMessages.id, message.id));
    await deliverReply(message.id);
  }
  refresh();
}

/** Checks the agency inbox for replies. Called by the enquiry pages while they are open. */
export async function checkInbox(): Promise<{ imported: number; error?: string }> {
  await requireUser();
  const result = await syncInbox();
  if (result.status === "ok") return { imported: result.imported };
  if (result.status === "error") return { imported: 0, error: result.error };
  return { imported: 0 };
}
