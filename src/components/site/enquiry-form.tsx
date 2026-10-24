"use client";

import { useActionState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import type { EnquiryField, EnquiryState } from "@/app/[locale]/(pages)/enquiry-actions";

const control =
  "border-line bg-surface text-ink w-full rounded-md border px-3 py-2.5 text-sm focus:border-accent focus:ring-accent/20 focus:ring-2 focus:outline-none aria-invalid:border-danger";

export function EnquiryForm({
  action,
  t,
  defaultMessage,
  idPrefix = "enquiry",
  messageRows = 4,
}: {
  action: (state: EnquiryState, formData: FormData) => Promise<EnquiryState>;
  t: Dictionary["enquiry"];
  defaultMessage: string;
  /** Keeps ids unique when a page has two forms (a listing page with the header's dialog open). */
  idPrefix?: string;
  messageRows?: number;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  if (state.ok) {
    return (
      <div role="status" className="bg-accent-soft rounded-lg p-5">
        <p className="font-display text-accent-strong text-xl">{t.successTitle}</p>
        <p className="text-ink mt-1 text-sm">{t.successBody}</p>
      </div>
    );
  }

  const errorFor = (field: EnquiryField) =>
    state.errors?.[field]
      ? { "aria-invalid": true as const, "aria-describedby": `${idPrefix}-${field}-error` }
      : {};
  const message = (field: EnquiryField) =>
    state.errors?.[field] ? (
      <p id={`${idPrefix}-${field}-error`} className="text-danger text-xs">
        {t.errors[field]}
      </p>
    ) : null;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {/* Honeypot, hidden from people and screen readers. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{t.name}</span>
        <input
          name="name"
          autoComplete="name"
          defaultValue={state.values?.name}
          className={control}
          {...errorFor("name")}
        />
        {message("name")}
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{t.email}</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.values?.email}
          className={control}
          {...errorFor("email")}
        />
        {message("email")}
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">
          {t.phone} <span className="text-muted font-normal">({t.optional})</span>
        </span>
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={state.values?.phone}
          className={control}
          {...errorFor("phone")}
        />
        {message("phone")}
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{t.message}</span>
        <textarea
          name="message"
          rows={messageRows}
          defaultValue={state.values?.message ?? defaultMessage}
          className={cn(control, "resize-y")}
          {...errorFor("message")}
        />
        {message("message")}
      </label>

      <div className="flex flex-col gap-1.5">
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="consent"
            className="accent-accent mt-0.5 size-4 shrink-0"
            {...errorFor("consent")}
          />
          <span className="text-muted">{t.consent}</span>
        </label>
        {message("consent")}
      </div>

      {state.errors?.generic || state.errors?.tooMany ? (
        <p role="alert" className="bg-danger-soft text-danger rounded-md px-3 py-2 text-sm">
          {state.errors.tooMany ? t.errors.tooMany : t.errors.generic}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="bg-accent hover:bg-accent-strong h-11 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-60"
      >
        {pending ? t.sending : t.submit}
      </button>
    </form>
  );
}
