"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { errorProps, Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { useAdminI18n } from "@/i18n/admin/client";
import { LOCALE_LABELS, LOCALES } from "@/lib/constants";
import type { PropertyFormValues } from "@/lib/properties/form-values";
import { OTHER_TOWN, TOWNS } from "@/lib/properties/towns";
import type { PropertyFormState } from "./actions";

type Locale = (typeof LOCALES)[number];

export function PropertyForm({
  action,
  initialValues,
  submitLabel,
  readOnly = false,
}: {
  action: (state: PropertyFormState, formData: FormData) => Promise<PropertyFormState>;
  initialValues: PropertyFormValues;
  submitLabel: string;
  readOnly?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const { t } = useAdminI18n();
  // After a failed save, what the agent typed; otherwise what the server has (which can change
  // without this form, e.g. "Publish now" in the publishing panel sets the status).
  const values = state.values && !state.success ? state.values : initialValues;
  const errors = state.fieldErrors ?? {};

  // The <form> remounts when the values change, so uncontrolled fields show them. The action
  // state lives above it and survives, so "Saved." stays on screen.
  const formKey = JSON.stringify(values);

  return (
    <form key={formKey} action={formAction} noValidate className="flex max-w-3xl flex-col gap-6">
      <Fields values={values} errors={errors} disabled={readOnly || pending} />

      {!readOnly ? (
        <div className="border-line bg-canvas/95 md:bg-surface sticky bottom-0 -mx-4 flex flex-wrap items-center gap-4 border-t px-4 py-4 backdrop-blur md:mx-0 md:rounded-xl md:border">
          <Button type="submit" disabled={pending}>
            {pending ? t.common.saving : submitLabel}
          </Button>
          <FormMessage state={state} />
        </div>
      ) : null}
    </form>
  );
}

/**
 * The inputs. Rendered inside the keyed <form>, so its little bits of state (which operation,
 * whether "Other…" town is picked) start over from the values whenever the form remounts.
 */
function Fields({
  values,
  errors,
  disabled,
}: {
  values: PropertyFormValues;
  errors: Record<string, string[]>;
  disabled: boolean;
}) {
  const { t } = useAdminI18n();
  const [operation, setOperation] = useState<"sale" | "rent">(
    values.operation === "rent" ? "rent" : "sale",
  );
  const [otherTown, setOtherTown] = useState(values.town === OTHER_TOWN);

  const field = (name: string) => ({
    id: name,
    name,
    defaultValue: values[name] ?? "",
    ...errorProps(name, errors[name]),
  });

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-6">
      <Section title={t.form.basics}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t.form.type} htmlFor="type" errors={errors.type}>
            <Select {...field("type")}>
              {Object.entries(t.labels.types).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.form.operation} htmlFor="operation" errors={errors.operation}>
            <Select
              {...field("operation")}
              onChange={(e) => setOperation(e.target.value === "rent" ? "rent" : "sale")}
            >
              {Object.entries(t.labels.operations).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t.form.status}
            htmlFor="status"
            errors={errors.status}
            hint={t.form.statusHint}
          >
            <Select {...field("status")}>
              {Object.entries(t.labels.statuses).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Field
            label={t.form.price}
            htmlFor="price"
            errors={errors.price}
            hint={t.form.priceHint[operation]}
          >
            <Input {...field("price")} inputMode="numeric" />
          </Field>
          <Field label={t.form.bedrooms} htmlFor="bedrooms" errors={errors.bedrooms}>
            <Input {...field("bedrooms")} inputMode="numeric" />
          </Field>
          <Field label={t.form.bathrooms} htmlFor="bathrooms" errors={errors.bathrooms}>
            <Input {...field("bathrooms")} inputMode="numeric" />
          </Field>
          <Field label={t.form.area} htmlFor="area" errors={errors.area} hint={t.form.areaHint}>
            <Input {...field("area")} inputMode="numeric" />
          </Field>
          <Field
            label={t.form.plot}
            htmlFor="plotArea"
            errors={errors.plotArea}
            hint={t.form.plotHint}
          >
            <Input {...field("plotArea")} inputMode="numeric" />
          </Field>
        </div>
      </Section>

      <Section title={t.form.location}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Field label={t.form.town} htmlFor="town" errors={errors.town}>
              <Select
                {...field("town")}
                onChange={(e) => setOtherTown(e.target.value === OTHER_TOWN)}
              >
                <option value="" disabled>
                  {t.form.chooseTown}
                </option>
                {TOWNS.map((town) => (
                  <option key={town} value={town}>
                    {town}
                  </option>
                ))}
                <option value={OTHER_TOWN}>{t.form.otherTown}</option>
              </Select>
            </Field>
            {otherTown ? (
              <Field label={t.form.townName} htmlFor="townOther" errors={errors.townOther}>
                <Input
                  {...field("townOther")}
                  placeholder="Finestrat"
                  autoFocus={!values.townOther}
                />
              </Field>
            ) : null}
          </div>
          <Field label={t.form.province} htmlFor="province" errors={errors.province}>
            <Input {...field("province")} />
          </Field>
          <Field
            label={t.form.latitude}
            htmlFor="latitude"
            errors={errors.latitude}
            hint={t.form.coordinatesHint}
          >
            <Input {...field("latitude")} inputMode="decimal" placeholder="37.978" />
          </Field>
          <Field label={t.form.longitude} htmlFor="longitude" errors={errors.longitude}>
            <Input {...field("longitude")} inputMode="decimal" placeholder="-0.682" />
          </Field>
        </div>
      </Section>

      <Section title={t.form.descriptions}>
        <LocaleTabs errors={errors} field={field} />
      </Section>
    </fieldset>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-line bg-surface flex flex-col gap-4 rounded-xl border p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function FormMessage({ state }: { state: PropertyFormState }) {
  const { t } = useAdminI18n();
  if (state.error) {
    return (
      <p role="alert" className="text-danger text-sm">
        {state.error}
      </p>
    );
  }
  if (state.fieldErrors && Object.keys(state.fieldErrors).length > 0) {
    return (
      <p role="alert" className="text-danger text-sm">
        {t.editor.needsAttention}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="text-ok text-sm">
        {state.success}
      </p>
    );
  }
  return null;
}

function LocaleTabs({
  errors,
  field,
}: {
  errors: Record<string, string[]>;
  field: (name: string) => Record<string, unknown>;
}) {
  const hasError = (locale: Locale) =>
    Boolean(errors[`translations.${locale}.title`] || errors[`translations.${locale}.description`]);
  const [active, setActive] = useState<Locale>(() => LOCALES.find(hasError) ?? "es");
  const { t } = useAdminI18n();

  return (
    <div>
      <div
        role="tablist"
        aria-label={t.form.languages}
        className="border-line mb-4 flex gap-1 border-b"
      >
        {LOCALES.map((locale) => (
          <button
            key={locale}
            type="button"
            role="tab"
            id={`tab-${locale}`}
            aria-selected={active === locale}
            aria-controls={`panel-${locale}`}
            onClick={() => setActive(locale)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors",
              active === locale
                ? "border-accent text-ink font-medium"
                : "text-muted hover:text-ink border-transparent",
            )}
          >
            {LOCALE_LABELS[locale]}
            {locale === "es" ? <span className="text-muted text-xs">{t.form.required}</span> : null}
            {hasError(locale) ? (
              <>
                <span className="bg-danger size-2 rounded-full" aria-hidden />
                <span className="sr-only">{t.form.hasErrors}</span>
              </>
            ) : null}
          </button>
        ))}
      </div>

      {/* Every panel stays in the DOM so all languages are submitted together. */}
      {LOCALES.map((locale) => {
        const titleName = `translations.${locale}.title`;
        const descriptionName = `translations.${locale}.description`;
        return (
          <div
            key={locale}
            role="tabpanel"
            id={`panel-${locale}`}
            aria-labelledby={`tab-${locale}`}
            hidden={active !== locale}
            className="flex flex-col gap-4"
          >
            <Field label={t.form.title} htmlFor={titleName} errors={errors[titleName]}>
              <Input {...field(titleName)} lang={locale} />
            </Field>
            <Field
              label={t.form.description}
              htmlFor={descriptionName}
              errors={errors[descriptionName]}
            >
              <Textarea {...field(descriptionName)} lang={locale} rows={6} />
            </Field>
          </div>
        );
      })}
    </div>
  );
}
