"use server";

import { and, eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/db";
import { leads, properties } from "@/db/schema";
import { DEMO_LIMITS } from "@/demo/config";
import { hit, visitorKey, WINDOWS } from "@/demo/rate-limit";
import { demoLeadVisitors } from "@/demo/schema";
import { getCurrentUser } from "@/lib/auth/dal";

export type EnquiryField = "name" | "email" | "phone" | "message" | "consent";

/**
 * Errors are returned as field codes, not sentences: Server Actions can't read the page language,
 * and the form already holds the translated messages.
 */
export type EnquiryState = {
  ok?: boolean;
  errors?: Partial<Record<EnquiryField | "generic" | "tooMany", true>>;
  values?: { name: string; email: string; phone: string; message: string };
};

const EnquirySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().max(200),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v === "" || /^\+?[\d\s().-]{6,25}$/.test(v)),
  message: z.string().trim().min(10).max(2000),
  consent: z.literal("on"),
});

/**
 * Saves an enquiry as a lead. With a property id it is about that home (which must be on sale or
 * for rent right now); with null it is a general message from the contact page.
 */
export async function sendEnquiry(
  propertyId: string | null,
  _prev: EnquiryState,
  formData: FormData,
): Promise<EnquiryState> {
  const text = (name: string) => {
    const v = formData.get(name);
    return typeof v === "string" ? v : "";
  };
  const values = {
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    message: text("message"),
  };

  // Honeypot: a field people never see. Bots fill it in; pretend it worked and store nothing.
  if (text("website")) return { ok: true };

  const parsed = EnquirySchema.safeParse({ ...values, consent: text("consent") });
  if (!parsed.success) {
    const errors: EnquiryState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string") errors[field as EnquiryField] = true;
    }
    return { errors, values };
  }

  if (propertyId !== null) {
    if (!z.uuid().safeParse(propertyId).success) return { errors: { generic: true }, values };
    const [property] = await db
      .select({ id: properties.id })
      .from(properties)
      .where(and(eq(properties.id, propertyId), eq(properties.status, "active")));
    if (!property) return { errors: { generic: true }, values };
  }

  // Demo version: a public form, so it is rate-limited per connection and per day.
  const visitor = await visitorKey();
  const allowed =
    (await hit(`enquiry:ip:${visitor}`, DEMO_LIMITS.enquiriesPerIpPer10Min, WINDOWS.tenMinutes)) &&
    (await hit("enquiry:all", DEMO_LIMITS.enquiriesPerDay, WINDOWS.day));
  if (!allowed) return { errors: { tooMany: true }, values };

  const { name, email, phone, message } = parsed.data;
  try {
    const [lead] = await db
      .insert(leads)
      .values({ propertyId, name, email, phone: phone || null, message })
      .returning({ id: leads.id });
    // Sent from a browser with a demo sandbox: that sandbox sees it in its back office.
    const viewer = await getCurrentUser();
    if (viewer?.role === "demo") {
      await db.insert(demoLeadVisitors).values({ leadId: lead!.id, userId: viewer.id });
    }
  } catch (error) {
    // A visitor's message must never vanish silently: keep what they typed and ask to resend.
    console.error("Could not save an enquiry", error);
    return { errors: { generic: true }, values };
  }
  return { ok: true };
}
