import Form from "next/form";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { BEDROOM_OPTIONS, hasActiveFilters, type CatalogFilters } from "@/lib/catalog/filters";
import { propertyType } from "@/db/schema";
import { control, Field, OperationToggle, select, submitButton } from "./search-fields";

/**
 * A plain GET form: works without JavaScript, and every search is a shareable URL.
 * next/form turns submits into client-side navigations when JavaScript is available.
 */
export function CatalogFiltersForm({
  locale,
  dict,
  filters,
  towns,
}: {
  locale: Locale;
  dict: Dictionary;
  filters: CatalogFilters;
  towns: string[];
}) {
  const t = dict.filters;
  const operations = [
    { value: "", label: t.any },
    { value: "sale", label: t.sale },
    { value: "rent", label: t.rent },
  ];

  return (
    <Form action={`/${locale}/homes`} className="flex flex-col gap-4" aria-label={t.legend}>
      <OperationToggle
        legend={t.operation}
        options={operations}
        defaultValue={filters.operation ?? ""}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1fr_1fr_1fr_0.8fr_1fr_auto] lg:items-end">
        <Field label={t.type}>
          <select name="type" defaultValue={filters.type ?? ""} className={select}>
            <option value="">{t.anyType}</option>
            {propertyType.enumValues.map((type) => (
              <option key={type} value={type}>
                {dict.propertyTypes[type]}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t.town}>
          <select name="town" defaultValue={filters.town ?? ""} className={select}>
            <option value="">{t.anyTown}</option>
            {towns.map((town) => (
              <option key={town} value={town}>
                {town}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t.maxPrice}>
          <input
            name="maxPrice"
            inputMode="numeric"
            placeholder={t.maxPricePlaceholder}
            defaultValue={filters.maxPrice ?? ""}
            className={control}
          />
        </Field>

        <Field label={t.minBedrooms}>
          <select name="bedrooms" defaultValue={filters.minBedrooms ?? ""} className={select}>
            <option value="">{t.any}</option>
            {BEDROOM_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}+
              </option>
            ))}
          </select>
        </Field>

        <Field label={t.sort}>
          <select name="sort" defaultValue={filters.sort} className={select}>
            <option value="newest">{t.sortNewest}</option>
            <option value="price-asc">{t.sortPriceAsc}</option>
            <option value="price-desc">{t.sortPriceDesc}</option>
          </select>
        </Field>

        <button type="submit" className={`${submitButton} col-span-2 lg:col-span-1`}>
          {t.submit}
        </button>
      </div>

      {hasActiveFilters(filters) ? (
        <Link
          href={`/${locale}/homes`}
          className="text-accent w-fit text-sm underline underline-offset-4"
        >
          {t.reset}
        </Link>
      ) : null}
    </Form>
  );
}
