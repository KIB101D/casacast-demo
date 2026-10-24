import "server-only";
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject } from "mailparser";
import { db } from "@/db";
import { leadMessages, leads, mailSyncState } from "@/db/schema";
import { extractReply, normalizeMessageId, referencedIds, tokenFromAddresses } from "./threading";
import { mailConfig } from "./transport";

/**
 * Reads new emails in the agency inbox over IMAP and files client replies under their enquiries.
 *
 * - Cursor: IMAP gives each message a growing UID; we keep the last one seen (per UIDVALIDITY),
 *   so each email is looked at once. The Message-ID is unique in the table as a second guard.
 * - Lease: like the publishing queue, a short lock on the cursor row keeps two syncs apart.
 * - Only replies are imported (a lead token in the recipients, or a reply to one of our emails);
 *   any other mail stays in the mailbox, untouched.
 */

const MAILBOX = "INBOX";
const LEASE_SECONDS = 60;
/** On the very first run, look back this many messages rather than at the whole history. */
const FIRST_RUN_LOOKBACK = 50;
const MAX_BODY = 20_000;

export type SyncResult =
  | { status: "skipped"; reason: "not-configured" | "busy" }
  | { status: "ok"; imported: number; leadIds: string[] }
  | { status: "error"; error: string };

function addresses(...objects: (AddressObject | AddressObject[] | undefined)[]) {
  return objects
    .flatMap((o) => (Array.isArray(o) ? o : o ? [o] : []))
    .flatMap((o) => o.value)
    .map((a) => a.address)
    .filter((a): a is string => Boolean(a));
}

async function acquireLease() {
  await db.insert(mailSyncState).values({ mailbox: MAILBOX }).onConflictDoNothing();
  const [row] = await db
    .update(mailSyncState)
    .set({ lockedUntil: sql`now() + make_interval(secs => ${LEASE_SECONDS})` })
    .where(
      and(
        eq(mailSyncState.mailbox, MAILBOX),
        or(isNull(mailSyncState.lockedUntil), lt(mailSyncState.lockedUntil, sql`now()`)),
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Files one email under its enquiry, if it is a reply to one. Returns the lead id, or null for
 * mail that isn't ours to import. Unreadable mail is skipped; database errors are thrown.
 */
async function fileMessage(source: Buffer, mailbox: string): Promise<string | null> {
  let parsed: Awaited<ReturnType<typeof simpleParser>>;
  try {
    parsed = await simpleParser(source);
  } catch {
    return null;
  }
  const from = addresses(parsed.from)[0] ?? "";
  if (from.toLowerCase() === mailbox.toLowerCase()) return null; // our own mail

  const messageId = normalizeMessageId(parsed.messageId);
  const recipients = [
    ...addresses(parsed.to, parsed.cc),
    ...["delivered-to", "x-original-to"].flatMap((h) => {
      const value = parsed.headers.get(h);
      return typeof value === "string" ? [value] : [];
    }),
  ];

  // 1. The lead token in the address it was sent to.
  let leadId: string | null = null;
  const token = tokenFromAddresses(recipients, mailbox);
  if (token) {
    const [lead] = await db.select({ id: leads.id }).from(leads).where(eq(leads.replyToken, token));
    leadId = lead?.id ?? null;
  }
  // 2. A reply to one of our emails, by Message-ID.
  const refs = referencedIds(parsed.inReplyTo, parsed.references);
  if (!leadId && refs.length > 0) {
    const [ours] = await db
      .select({ leadId: leadMessages.leadId })
      .from(leadMessages)
      .where(and(eq(leadMessages.direction, "outbound"), inArray(leadMessages.messageId, refs)))
      .limit(1);
    leadId = ours?.leadId ?? null;
  }
  if (!leadId) return null;

  const body = extractReply(parsed.text ?? "").slice(0, MAX_BODY);
  const [row] = await db
    .insert(leadMessages)
    .values({
      leadId,
      direction: "inbound",
      status: "received",
      body: body || "(no text)",
      subject: parsed.subject ?? null,
      fromAddress: from,
      messageId,
      inReplyTo: refs[0] ?? null,
      // When we received it, not the sender's Date header: senders' clocks drift, and the
      // conversation must stay in the order things happened here.
      createdAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: leadMessages.id });
  if (!row) return null; // already imported

  // The client answered: the enquiry needs attention again.
  await db.update(leads).set({ status: "new" }).where(eq(leads.id, leadId));
  return leadId;
}

export async function syncInbox(): Promise<SyncResult> {
  const config = mailConfig();
  if (!config) return { status: "skipped", reason: "not-configured" };
  const state = await acquireLease();
  if (!state) return { status: "skipped", reason: "busy" };

  const client = new ImapFlow({
    host: config.imap.host,
    port: config.imap.port,
    secure: config.imap.secure,
    auth: { user: config.address, pass: config.password },
    logger: false,
    connectionTimeout: 10_000,
  });

  let lastUid = state.lastUid;
  let uidValidity = state.uidValidity;
  const imported = new Set<string>();

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen(MAILBOX, { readOnly: true });
    const currentValidity = String(mailbox.uidValidity);
    if (uidValidity !== currentValidity) {
      // New mailbox or rebuilt UIDs: start near the end instead of reading all history again.
      uidValidity = currentValidity;
      lastUid = Math.max(0, Number(mailbox.uidNext) - 1 - FIRST_RUN_LOOKBACK);
    }

    if (mailbox.exists > 0) {
      // `N:*` always returns the newest message, even when N is past it: filter by UID.
      for await (const message of client.fetch(
        `${lastUid + 1}:*`,
        { uid: true, source: true },
        { uid: true },
      )) {
        if (message.uid <= lastUid) continue;
        const leadId = message.source ? await fileMessage(message.source, config.address) : null;
        if (leadId) imported.add(leadId);
        // Advance only once the message is filed: a database error stops here and retries it.
        lastUid = message.uid;
      }
    }

    await db
      .update(mailSyncState)
      .set({ lastUid, uidValidity, lockedUntil: null, lastSyncedAt: new Date(), lastError: null })
      .where(eq(mailSyncState.mailbox, MAILBOX));
    return { status: "ok", imported: imported.size, leadIds: [...imported] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Keep the progress made before the failure; the next sync continues from there.
    await db
      .update(mailSyncState)
      .set({ lastUid, uidValidity, lockedUntil: null, lastError: message })
      .where(eq(mailSyncState.mailbox, MAILBOX));
    return { status: "error", error: message };
  } finally {
    await client.logout().catch(() => {});
  }
}
