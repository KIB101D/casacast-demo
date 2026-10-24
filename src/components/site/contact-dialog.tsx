"use client";

import { useRef, useState } from "react";
import type { EnquiryState } from "@/app/[locale]/(pages)/enquiry-actions";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { EnquiryForm } from "./enquiry-form";

/**
 * "Get in touch" in the header: a button that opens the general enquiry form in a modal.
 * A native <dialog> opened with showModal(): it sits in the top layer (above the sticky header),
 * traps focus, closes on Escape and gives focus back to the button.
 */
export function ContactDialog({
  action,
  label,
  closeLabel,
  title,
  intro,
  defaultMessage,
  t,
  className,
}: {
  action: (state: EnquiryState, formData: FormData) => Promise<EnquiryState>;
  label: string;
  closeLabel: string;
  title: string;
  intro: string;
  defaultMessage: string;
  t: Dictionary["enquiry"];
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  // The form exists only while the dialog is open, and is a fresh one each time, so a sent
  // enquiry doesn't leave the "thank you" behind and the page never holds a hidden second form.
  const [opened, setOpened] = useState(0);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setOpened((n) => n + 1);
          setOpen(true);
          dialog.current?.showModal();
        }}
        className={className}
      >
        {/* On phones only the envelope fits next to the menu; the text is still read out. */}
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="size-[1.1rem] sm:hidden"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        >
          <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
          <path d="m3 5.5 7 5.5 7-5.5" />
        </svg>
        <span className="max-sm:sr-only">{label}</span>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="contact-dialog-title"
        onClose={() => setOpen(false)}
        // A click on the backdrop lands on the <dialog> itself, not on its content.
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        className={cn(
          "bg-surface text-ink m-auto w-[min(32rem,calc(100%-2rem))] max-w-none rounded-xl p-0 shadow-2xl",
          "backdrop:bg-ink/50 backdrop:backdrop-blur-[2px]",
          "max-h-[calc(100dvh-2rem)] overscroll-contain",
        )}
      >
        <div className="p-6 sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 id="contact-dialog-title" className="font-display text-3xl">
                {title}
              </h2>
              <p className="text-muted mt-1 text-sm">{intro}</p>
            </div>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="text-muted hover:text-ink hover:bg-canvas -mt-1 -mr-2 grid size-9 shrink-0 place-items-center rounded-full transition-colors"
            >
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <path d="M5 5l10 10M15 5 5 15" />
              </svg>
              <span className="sr-only">{closeLabel}</span>
            </button>
          </div>
          {open ? (
            <EnquiryForm
              key={opened}
              action={action}
              t={t}
              defaultMessage={defaultMessage}
              idPrefix="contact-dialog"
            />
          ) : null}
        </div>
      </dialog>
    </>
  );
}
