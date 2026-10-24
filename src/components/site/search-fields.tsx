import type { ReactNode } from "react";

/**
 * Shared pieces of the two search forms (home banner and catalogue), so they look the same:
 * caption above the control, bordered 44 px controls, the same button.
 */
export const control =
  "border-line bg-surface text-ink h-11 w-full rounded-md border px-3 text-sm focus:border-accent focus:ring-accent/20 focus:ring-2 focus:outline-none";
export const select = `${control} select-chevron pr-10`;
export const submitButton =
  "bg-accent hover:bg-accent-strong h-11 rounded-md px-6 text-sm font-medium text-white transition-colors";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

/** Segmented radio group for buy / rent (and "any" in the catalogue). */
export function OperationToggle({
  legend,
  options,
  defaultValue,
}: {
  legend: string;
  options: { value: string; label: string }[];
  defaultValue: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-muted mb-2 text-sm">{legend}</legend>
      <div className="border-line bg-surface inline-flex w-fit rounded-md border p-1">
        {options.map((op) => (
          <label key={op.value || "any"} className="relative">
            <input
              type="radio"
              name="operation"
              value={op.value}
              defaultChecked={defaultValue === op.value}
              className="peer sr-only"
            />
            <span className="text-muted peer-checked:bg-accent peer-focus-visible:outline-accent block cursor-pointer rounded px-4 py-1.5 text-sm transition-colors peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
              {op.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
