import { PageHeader } from "@/components/admin/page-header";
import { adminTitle, getAdminI18n } from "@/i18n/admin/server";
import { EMPTY_PROPERTY_VALUES } from "@/lib/properties/form-values";
import { createProperty } from "../actions";
import { PropertyForm } from "../property-form";

export const generateMetadata = adminTitle("newListing");

export default async function NewPropertyPage() {
  const { t } = await getAdminI18n();
  return (
    <>
      <PageHeader title={t.meta.newListing} description={t.editor.newDescription} />
      <PropertyForm
        action={createProperty}
        initialValues={EMPTY_PROPERTY_VALUES}
        submitLabel={t.editor.create}
      />
    </>
  );
}
