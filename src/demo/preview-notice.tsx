"use client";

import { useState } from "react";

/** The note on a sandbox's own listing page (see preview.ts). It can be closed. */
export function DemoPreviewNotice({
  title,
  body,
  closeLabel,
}: {
  title: string;
  body: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <div
      role="status"
      className="border-accent/30 bg-accent-soft mt-4 flex items-start gap-4 rounded-lg border px-5 py-4"
    >
      <div className="min-w-0 flex-1">
        <p className="text-accent-strong font-medium">{title}</p>
        <p className="text-ink mt-1 text-sm">{body}</p>
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-muted hover:text-ink -mt-1 -mr-2 grid size-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-white/60"
      >
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        >
          <path d="M5 5l10 10M15 5 5 15" />
        </svg>
        <span className="sr-only">{closeLabel}</span>
      </button>
    </div>
  );
}
