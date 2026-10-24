import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Notice, PageHeader, Skeleton } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { adminTitle, getAdminI18n } from "@/i18n/admin/server";
import { STATUS_TONES } from "@/lib/labels";
import { canViewListing } from "@/demo/visibility";
import { canModifyProperty, LIMITS } from "@/lib/permissions";
import { listPhotos } from "@/lib/photos/queries";
import { valuesFromProperty } from "@/lib/properties/form-values";
import { countLeadsByStatus } from "@/lib/leads/queries";
import { getProperty } from "@/lib/properties/queries";
import { ensurePublications } from "@/lib/publishing/queue";
import { getPublishingPanel } from "@/lib/publishing/views";
import { updateProperty } from "../actions";
import { DeletePropertyButton } from "../delete-button";
import { PhotoManager } from "../photo-manager";
import { PropertyForm } from "../property-form";
import { PublishingPanel } from "../publishing-panel";

export const generateMetadata = adminTitle("editListing");

export default function EditPropertyPage(props: PageProps<"/admin/properties/[id]">) {
  return (
    <Suspense
      fallback={
        <>
          <Skeleton className="mb-6 h-12 w-64" />
          <Skeleton className="h-[640px]" />
        </>
      }
    >
      <EditProperty {...props} />
    </Suspense>
  );
}

async function EditProperty({ params, searchParams }: PageProps<"/admin/properties/[id]">) {
  const [{ id }, query, user, { t }] = await Promise.all([
    params,
    searchParams,
    requireUser(),
    getAdminI18n(),
  ]);
  const property = await getProperty(id);
  // Demo version: another visitor's sandbox listing doesn't exist for you.
  if (!property || !canViewListing(user, property)) notFound();
  // Listings created before publishing existed get their channel rows on first view.
  await ensurePublications(property.id, property.createdBy.role);
  const [photos, publishing, leadCounts] = await Promise.all([
    listPhotos(property.id),
    getPublishingPanel(property.id),
    countLeadsByStatus(user, property.id),
  ]);
  const enquiries = leadCounts.new + leadCounts.in_progress + leadCounts.handled;

  const editable = canModifyProperty(user, property);
  const title =
    property.translations.find((t) => t.locale === "en")?.title ??
    property.translations.find((t) => t.locale === "es")?.title ??
    property.reference;

  return (
    <>
      <PageHeader
        title={title}
        description={
          <span className="flex items-center gap-2">
            <span className="font-mono">{property.reference}</span>
            <Badge tone={STATUS_TONES[property.status]}>{t.labels.statuses[property.status]}</Badge>
            {enquiries > 0 ? (
              <Link
                href={`/admin/leads?property=${property.id}`}
                className="text-accent hover:underline"
              >
                {t.editor.enquiries(enquiries, leadCounts.new)}
              </Link>
            ) : null}
          </span>
        }
        actions={
          <>
            {property.status === "active" || property.status === "sold" ? (
              // The short /homes/<reference> URL redirects to the full one with the title in it.
              <ButtonLink
                href={`/es/homes/${property.reference.toLowerCase()}`}
                variant="secondary"
                target="_blank"
              >
                {t.editor.viewOnSite}
              </ButtonLink>
            ) : null}
            {editable ? <DeletePropertyButton id={property.id} /> : null}
          </>
        }
      />
      {query.created ? <Notice tone="ok">{t.editor.created}</Notice> : null}
      {!editable ? <Notice tone="warn">{t.editor.readOnly}</Notice> : null}
      <PublishingPanel
        key={property.updatedAt.toISOString()}
        propertyId={property.id}
        propertyStatus={property.status}
        initial={publishing}
        editable={editable}
        demoListing={property.createdBy.role === "demo"}
      />
      <PhotoManager
        propertyId={property.id}
        initialPhotos={photos}
        maxPhotos={LIMITS[user.role].photosPerProperty}
        editable={editable}
      />
      <PropertyForm
        action={updateProperty.bind(null, property.id)}
        initialValues={valuesFromProperty(property)}
        submitLabel={t.editor.saveChanges}
        readOnly={!editable}
      />
    </>
  );
}
