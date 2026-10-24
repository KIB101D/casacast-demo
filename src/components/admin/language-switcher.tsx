"use client";

import { useTransition } from "react";
import { ADMIN_LOCALE_NAMES, ADMIN_LOCALES } from "@/i18n/admin";
import { setAdminLocale } from "@/i18n/admin/actions";
import { useAdminI18n } from "@/i18n/admin/client";
import { cn } from "@/lib/cn";

/** EN / UK toggle for the back office. The choice is kept in a cookie. */
export function AdminLanguageSwitcher({ className }: { className?: string }) {
  const { locale, t } = useAdminI18n();
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label={t.shell.language}
      className={cn("border-line bg-surface inline-flex rounded-lg border p-0.5", className)}
    >
      {ADMIN_LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          title={ADMIN_LOCALE_NAMES[option]}
          aria-pressed={option === locale}
          disabled={pending}
          onClick={() => {
            if (option !== locale) startTransition(() => setAdminLocale(option));
          }}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs transition-colors disabled:cursor-wait",
            option === locale
              ? "bg-accent-soft text-accent-strong font-medium"
              : "text-muted hover:text-ink",
          )}
        >
          {option.toUpperCase()}
          <span className="sr-only"> {ADMIN_LOCALE_NAMES[option]}</span>
        </button>
      ))}
    </div>
  );
}
