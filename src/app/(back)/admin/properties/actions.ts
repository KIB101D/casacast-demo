"use server";

import { and, desc, eq, like, notInArray, sql } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { LISTINGS_TAG } from "@/lib/catalog/queries";
import { leads, properties, propertyTranslations } from "@/db/schema";
import { getAdminI18n } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/dal";
import { assertWithinLimits, canModifyProperty, LimitError } from "@/lib/permissions";
import { valuesFromFormData, type PropertyFormValues } from "@/lib/properties/form-values";
import { listPhotoStorageIds } from "@/lib/photos/queries";
import { ensurePublications, syncListing, withdrawEverywhere } from "@/lib/publishing/queue";
import { countPropertiesCreatedBy, getProperty } from "@/lib/properties/queries";
import { DEMO_LIMITS } from "@/demo/config";
import { hit, WINDOWS } from "@/demo/rate-limit";
import { removeStoredPhoto } from "@/demo/storage";
import { nextReference, REFERENCE_PREFIX } from "@/lib/properties/reference";
import {
  filledTranslations,
  parsePropertyForm,
  type FieldErrors,
  type PropertyInput,
} from "@/lib/validation/property";

export type PropertyFormState = {
  fieldErrors?: FieldErrors;
  error?: string;
  success?: string;
  values?: PropertyFormValues;
};

/** The `properties` row for a validated form; translations are stored separately. */
function propertyColumns(input: PropertyInput) {
  return {
    type: input.type,
    operation: input.operation,
    status: input.status,
    price: input.price,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    area: input.area,
    // Land has no separate plot: its area is the plot.
    plotArea: input.type === "land" ? null : (input.plotArea ?? null),
    town: input.town,
    province: input.province,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
  };
}

export async function createProperty(
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  const [user, { t }] = await Promise.all([requireUser(), getAdminI18n()]);
  const values = valuesFromFormData(formData);

  const parsed = parsePropertyForm(formData, t.validation);
  if (!parsed.success) return { fieldErrors: parsed.fieldErrors, values };

  try {
    assertWithinLimits(user.role, "createProperty", await countPropertiesCreatedBy(user.id));
  } catch (error) {
    if (error instanceof LimitError) return { error: t.limits[error.action](error.limit), values };
    throw error;
  }
  // Demo version: all sandboxes together share a daily cap.
  if (
    user.role === "demo" &&
    !(await hit("demo:listings", DEMO_LIMITS.listingsPerDay, WINDOWS.day))
  ) {
    return { error: t.editor.demoDailyLimit, values };
  }

  const id = await db.transaction(async (tx) => {
    // Serialise reference numbering so two saves at once can't both take CB-0011.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('property_reference'))`);
    const [last] = await tx
      .select({ reference: properties.reference })
      .from(properties)
      .where(like(properties.reference, `${REFERENCE_PREFIX}%`))
      .orderBy(desc(sql`length(${properties.reference})`), desc(properties.reference))
      .limit(1);

    const [created] = await tx
      .insert(properties)
      .values({
        ...propertyColumns(parsed.data),
        reference: nextReference(last?.reference),
        createdById: user.id,
      })
      .returning({ id: properties.id });

    await tx
      .insert(propertyTranslations)
      .values(filledTranslations(parsed.data).map((t) => ({ ...t, propertyId: created!.id })));

    return created!.id;
  });

  await ensurePublications(id, user.role);
  await syncListing(id);
  updateTag(LISTINGS_TAG);
  redirect(`/admin/properties/${id}?created=1`);
}

export async function updateProperty(
  id: string,
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  const [user, { t }] = await Promise.all([requireUser(), getAdminI18n()]);
  const property = await getProperty(id);
  if (!property) notFound();

  const values = valuesFromFormData(formData);
  if (!canModifyProperty(user, property)) return { error: t.editor.demoCantEdit, values };

  const parsed = parsePropertyForm(formData, t.validation);
  if (!parsed.success) return { fieldErrors: parsed.fieldErrors, values };

  const translations = filledTranslations(parsed.data);

  await db.transaction(async (tx) => {
    await tx.update(properties).set(propertyColumns(parsed.data)).where(eq(properties.id, id));

    for (const t of translations) {
      await tx
        .insert(propertyTranslations)
        .values({ ...t, propertyId: id })
        .onConflictDoUpdate({
          target: [propertyTranslations.propertyId, propertyTranslations.locale],
          set: { title: t.title, description: t.description },
        });
    }

    // A language that was cleared in the form is removed.
    await tx.delete(propertyTranslations).where(
      and(
        eq(propertyTranslations.propertyId, id),
        notInArray(
          propertyTranslations.locale,
          translations.map((t) => t.locale),
        ),
      ),
    );
  });

  // Every save syncs the listing to its channels: changed text or price is updated, and a status
  // change publishes (active), marks as sold, or withdraws (draft, archived).
  await syncListing(id);
  updateTag(LISTINGS_TAG);
  refresh();
  return { success: t.editor.saved, values };
}

export async function deleteProperty(id: string) {
  const user = await requireUser();
  const property = await getProperty(id);
  if (!property) notFound();
  if (!canModifyProperty(user, property)) {
    throw new Error("Not allowed to delete this listing.");
  }

  const storageIds = await listPhotoStorageIds(id);
  await withdrawEverywhere(id);
  // Enquiries about a demo listing belong to the demo: they go with it. On agency listings they
  // stay (the column is set to null), since the contact is still the agency's.
  if (property.createdBy.role === "demo") await db.delete(leads).where(eq(leads.propertyId, id));
  await db.delete(properties).where(eq(properties.id, id)); // photo rows go with it (cascade)

  // Files are cleaned up after the database change; a failure only leaves an unused file behind.
  const results = await Promise.allSettled(
    storageIds.map((publicId) => removeStoredPhoto(publicId)),
  );
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) console.error(`Could not delete ${failed} photo file(s) of listing ${id}`);

  updateTag(LISTINGS_TAG);
  redirect("/admin/properties?deleted=1");
}
