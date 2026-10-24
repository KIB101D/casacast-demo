import "server-only";
import { and, asc, count, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/db";
import {
  leadMessages,
  leads,
  leadStatus,
  properties,
  propertyTranslations,
  type UserRole,
} from "@/db/schema";
import { demoLeadVisitors } from "@/demo/schema";

type Viewer = { id: string; role: UserRole };

/** new: nobody answered yet (or the client wrote back); in_progress: the agency replied;
 * handled: an agent closed it. */
export type LeadStatus = (typeof leadStatus.enumValues)[number];

export const LEAD_STATUSES = leadStatus.enumValues;

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}

/**
 * The visibility rule from canSeeLead, as SQL. Demo version: a sandbox also sees the enquiries
 * sent from its own browser, about any listing or from the contact page.
 */
function visibleTo(viewer: Viewer): SQL | undefined {
  if (viewer.role === "admin") return undefined;
  return or(
    eq(properties.createdById, viewer.id),
    sql`exists (select 1 from ${demoLeadVisitors} v where v.lead_id = ${leads.id} and v.user_id = ${viewer.id})`,
  );
}

export type LeadView = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: LeadStatus;
  createdAt: Date;
  listing: { id: string; reference: string; title: string } | null;
};

export async function listLeads(
  viewer: Viewer,
  filter: { status?: LeadStatus; propertyId?: string } = {},
): Promise<LeadView[]> {
  const propertyId =
    filter.propertyId && z.uuid().safeParse(filter.propertyId).success
      ? filter.propertyId
      : undefined;
  return listLeadsWhere(
    viewer,
    and(
      filter.status ? eq(leads.status, filter.status) : undefined,
      propertyId ? eq(leads.propertyId, propertyId) : undefined,
    ),
  );
}

async function listLeadsWhere(viewer: Viewer, where: SQL | undefined): Promise<LeadView[]> {
  const rows = await db
    .select({
      id: leads.id,
      name: leads.name,
      email: leads.email,
      phone: leads.phone,
      message: leads.message,
      status: leads.status,
      createdAt: leads.createdAt,
      propertyId: properties.id,
      reference: properties.reference,
    })
    .from(leads)
    .leftJoin(properties, eq(properties.id, leads.propertyId))
    .where(and(visibleTo(viewer), where))
    .orderBy(desc(leads.createdAt))
    .limit(200);

  const ids = [...new Set(rows.map((r) => r.propertyId).filter((id) => id !== null))];
  const titles =
    ids.length === 0
      ? []
      : await db
          .select({
            propertyId: propertyTranslations.propertyId,
            locale: propertyTranslations.locale,
            title: propertyTranslations.title,
          })
          .from(propertyTranslations)
          .where(inArray(propertyTranslations.propertyId, ids));
  const titleFor = (id: string) =>
    titles.find((t) => t.propertyId === id && t.locale === "en")?.title ??
    titles.find((t) => t.propertyId === id)?.title ??
    "";

  return rows.map(({ propertyId: pid, reference, ...lead }) => ({
    ...lead,
    listing: pid && reference ? { id: pid, reference, title: titleFor(pid) } : null,
  }));
}

/** Counts per status for the tabs, with the same visibility as the list. */
export async function countLeadsByStatus(
  viewer: Viewer,
  propertyId?: string,
): Promise<Record<LeadStatus, number>> {
  const valid = propertyId && z.uuid().safeParse(propertyId).success ? propertyId : undefined;
  const rows = await db
    .select({ status: leads.status, value: count() })
    .from(leads)
    .leftJoin(properties, eq(properties.id, leads.propertyId))
    .where(and(visibleTo(viewer), valid ? eq(leads.propertyId, valid) : undefined))
    .groupBy(leads.status);
  return {
    new: rows.find((r) => r.status === "new")?.value ?? 0,
    in_progress: rows.find((r) => r.status === "in_progress")?.value ?? 0,
    handled: rows.find((r) => r.status === "handled")?.value ?? 0,
  };
}

/** The lead and its listing's owner, for permission checks. Null for unknown or malformed ids. */
export async function getLeadOwner(leadId: string) {
  if (!z.uuid().safeParse(leadId).success) return null;
  const [row] = await db
    .select({ id: leads.id, ownerId: properties.createdById, visitorId: demoLeadVisitors.userId })
    .from(leads)
    .leftJoin(properties, eq(properties.id, leads.propertyId))
    .leftJoin(demoLeadVisitors, eq(demoLeadVisitors.leadId, leads.id))
    .where(eq(leads.id, leadId));
  return row ?? null;
}

export type ConversationMessage = {
  id: string;
  direction: "outbound" | "inbound";
  status: "sending" | "sent" | "failed" | "simulated" | "received";
  body: string;
  error: string | null;
  createdAt: Date;
};

/** One enquiry with its email conversation, or null if unknown or not visible to this user. */
export async function getLeadConversation(viewer: Viewer, leadId: string) {
  if (!z.uuid().safeParse(leadId).success) return null;
  const [lead] = await listLeadsWhere(viewer, eq(leads.id, leadId));
  if (!lead) return null;
  const messages = await db
    .select({
      id: leadMessages.id,
      direction: leadMessages.direction,
      status: leadMessages.status,
      body: leadMessages.body,
      error: leadMessages.error,
      createdAt: leadMessages.createdAt,
    })
    .from(leadMessages)
    .where(eq(leadMessages.leadId, leadId))
    .orderBy(asc(leadMessages.createdAt));
  return { lead, messages: messages as ConversationMessage[] };
}

/** How many emails each lead's conversation has, for the list. */
export async function countMessages(leadIds: string[]) {
  if (leadIds.length === 0) return new Map<string, { total: number; lastInbound: Date | null }>();
  const rows = await db
    .select({
      leadId: leadMessages.leadId,
      total: count(),
      lastInbound: sql<Date | null>`max(${leadMessages.createdAt}) filter (where ${leadMessages.direction} = 'inbound')`,
    })
    .from(leadMessages)
    .where(inArray(leadMessages.leadId, leadIds))
    .groupBy(leadMessages.leadId);
  return new Map(
    rows.map((r) => [
      r.leadId,
      { total: r.total, lastInbound: r.lastInbound ? new Date(r.lastInbound) : null },
    ]),
  );
}
