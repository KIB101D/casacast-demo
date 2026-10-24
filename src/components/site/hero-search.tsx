import Form from "next/form";
import { propertyType } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { control, Field, OperationToggle, select, submitButton } from "./search-fields";

/**
 * The banner's search bar: the catalogue's filters in short (same fields, same look), submitting
 * to the catalogue with the same query parameters.
 *
 * The buy/rent toggle is off by default: the home page keeps the form short and searches homes
 * for sale. The operation still goes to the catalogue, as a hidden field.
 */
export function HeroSearch({
  locale,
  dict,
  towns,
  showOperation = false,
  operation = "sale",
}: {
  locale: Locale;
  dict: Dictionary;
  towns: string[];
  /** Show the buy/rent toggle. */
  showOperation?: boolean;
  /** Preselected operation, or the one sent when the toggle is hidden. */
  operation?: "sale" | "rent";
}) {
  const t = dict.filters;

  return (
    <Form
      action={`/${locale}/homes`}
      aria-label={t.legend}
      className="bg-surface/95 text-ink flex flex-col gap-4 rounded-md p-5 shadow-2xl backdrop-blur sm:p-6"
    >
      {showOperation ? (
        <OperationToggle
          legend={t.operation}
          options={[
            { value: "sale", label: t.sale },
            { value: "rent", label: t.rent },
          ]}
          defaultValue={operation}
        />
      ) : (
        <input type="hidden" name="operation" value={operation} />
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-end">
        <Field label={t.town}>
          <select name="town" defaultValue="" className={select}>
            <option value="">{t.anyTown}</option>
            {towns.map((town) => (
              <option key={town} value={town}>
                {town}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.type}>
          <select name="type" defaultValue="" className={select}>
            <option value="">{t.anyType}</option>
            {propertyType.enumValues.map((type) => (
              <option key={type} value={type}>
                {dict.propertyTypes[type]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.maxPrice}>
          <input
            name="maxPrice"
            inputMode="numeric"
            placeholder={t.maxPricePlaceholder}
            className={control}
          />
        </Field>
        <button type="submit" className={`${submitButton} sm:col-span-2 lg:col-span-1 lg:px-8`}>
          {t.search}
        </button>
      </div>
    </Form>
  );
}
