"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { getLeadOwner, isLeadStatus, type LeadStatus } from "@/lib/leads/queries";
import { canSeeLead } from "@/lib/permissions";

/** Closes an enquiry (handled) or reopens it (in progress). */
export async function setLeadStatus(leadId: string, status: LeadStatus) {
  if (!isLeadStatus(status)) throw new Error("Unknown status.");
  const user = await requireUser();
  const lead = await getLeadOwner(leadId);
  // Unknown and not-yours look the same, so ids can't be probed.
  if (!lead || !canSeeLead(user, lead.ownerId, lead.visitorId))
    throw new Error("Enquiry not found.");
  await db.update(leads).set({ status }).where(eq(leads.id, leadId));
  refresh();
}
