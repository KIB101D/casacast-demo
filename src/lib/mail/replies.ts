import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { leadMessages, leads, properties } from "@/db/schema";
import { AGENCY_CONTACT, AGENCY_NAME } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { siteUrl } from "@/lib/site-url";
import {
  composeReply,
  enquirySubject,
  newReplyToken,
  replyAddress,
  replySubject,
} from "./threading";
import { mailConfig, sendMail } from "./transport";

/**
 * Agent replies to an enquiry. The message is stored first (status `sending`), then sent, then
 * marked `sent` or `failed` with the server's error, so nothing typed is ever lost and a failed
 * email can be retried from the conversation.
 */

export class MailNotConfiguredError extends Error {
  constructor() {
    super("Email isn't set up: add MAIL_ADDRESS and MAIL_APP_PASSWORD to the environment.");
  }
}

/** Saves a reply. `simulate` (the demo account) records it as never sent. Returns the row id. */
export async function createReply(input: {
  leadId: string;
  body: string;
  sentById: string;
  simulate: boolean;
}) {
  const config = input.simulate ? null : mailConfig();
  if (!input.simulate && !config) throw new MailNotConfiguredError();

  const subject = await threadSubject(input.leadId);
  const domain = config ? config.address.split("@")[1] : "demo.casacast.invalid";
  const [row] = await db
    .insert(leadMessages)
    .values({
      leadId: input.leadId,
      direction: "outbound",
      status: input.simulate ? "simulated" : "sending",
      body: input.body,
      subject,
      fromAddress: config?.address ?? null,
      messageId: `${randomUUID()}@${domain}`,
      sentById: input.sentById,
    })
    .returning({ id: leadMessages.id });

  // The agent answered: the enquiry is in progress until an agent closes it (or the client
  // writes back, which makes it new again).
  await db.update(leads).set({ status: "in_progress" }).where(eq(leads.id, input.leadId));
  return row!.id;
}

/** Sends a stored outbound message (first try or retry) and records the outcome. */
export async function deliverReply(messageRowId: string) {
  const config = mailConfig();
  if (!config) throw new MailNotConfiguredError();

  const [message] = await db
    .select()
    .from(leadMessages)
    .where(and(eq(leadMessages.id, messageRowId), eq(leadMessages.direction, "outbound")));
  if (!message || message.status === "sent" || message.status === "simulated") return;

  const [lead] = await db.select().from(leads).where(eq(leads.id, message.leadId));
  if (!lead) return;
  const token = lead.replyToken ?? newReplyToken();
  if (!lead.replyToken) {
    await db.update(leads).set({ replyToken: token }).where(eq(leads.id, lead.id));
  }

  // Quote what we are answering: the client's latest email, or the enquiry itself.
  const thread = await db
    .select()
    .from(leadMessages)
    .where(eq(leadMessages.leadId, lead.id))
    .orderBy(asc(leadMessages.createdAt));
  const earlier = thread.filter((m) => m.createdAt <= message.createdAt && m.id !== message.id);
  const lastInbound = [...earlier].reverse().find((m) => m.direction === "inbound");
  const quoted = lastInbound
    ? { author: lead.name, date: formatDateTime(lastInbound.createdAt), text: lastInbound.body }
    : { author: lead.name, date: formatDateTime(lead.createdAt), text: lead.message };
  const site = siteUrl().toString().replace(/\/$/, "");

  try {
    await sendMail(config, {
      to: lead.email,
      replyTo: replyAddress(config.address, token),
      subject: message.subject ?? enquirySubject(null, config.fromName),
      text: composeReply({
        body: message.body,
        signature: `${config.fromName}\n${AGENCY_CONTACT.phone} · ${site}`,
        quoted,
      }),
      messageId: message.messageId!,
      inReplyTo: lastInbound?.messageId ?? undefined,
      references: earlier.map((m) => m.messageId).filter((id): id is string => Boolean(id)),
    });
    await db
      .update(leadMessages)
      .set({ status: "sent", error: null })
      .where(eq(leadMessages.id, message.id));
  } catch (error) {
    await db
      .update(leadMessages)
      .set({ status: "failed", error: error instanceof Error ? error.message : String(error) })
      .where(eq(leadMessages.id, message.id));
  }
}

/** One subject per conversation: "Re:" the client's latest email, or our first subject. */
async function threadSubject(leadId: string) {
  const [lastInbound] = await db
    .select({ subject: leadMessages.subject })
    .from(leadMessages)
    .where(and(eq(leadMessages.leadId, leadId), eq(leadMessages.direction, "inbound")))
    .orderBy(desc(leadMessages.createdAt))
    .limit(1);
  if (lastInbound?.subject) return replySubject(lastInbound.subject);

  const [first] = await db
    .select({ subject: leadMessages.subject })
    .from(leadMessages)
    .where(and(eq(leadMessages.leadId, leadId), eq(leadMessages.direction, "outbound")))
    .orderBy(asc(leadMessages.createdAt))
    .limit(1);
  if (first?.subject) return first.subject;

  const [row] = await db
    .select({ reference: properties.reference })
    .from(leads)
    .leftJoin(properties, eq(properties.id, leads.propertyId))
    .where(eq(leads.id, leadId));
  return enquirySubject(row?.reference ?? null, mailConfig()?.fromName ?? AGENCY_NAME);
}
