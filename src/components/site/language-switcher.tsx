"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";

/** Same page, other language: swaps the first path segment and keeps the filters. */
export function LanguageSwitcher({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  const hrefFor = (locale: Locale) => {
    const rest = pathname.split("/").slice(2).join("/");
    return `/${locale}${rest ? `/${rest}` : ""}${search ? `?${search}` : ""}`;
  };

  return (
    <nav aria-label={label}>
      <ul className="flex items-center gap-0.5 text-sm">
        {LOCALES.map((locale) => (
          <li key={locale}>
            <Link
              href={hrefFor(locale)}
              hrefLang={locale}
              lang={locale}
              aria-current={locale === current ? "true" : undefined}
              title={LOCALE_NAMES[locale]}
              className={cn(
                "block rounded-full px-2.5 py-1 transition-opacity",
                locale === current ? "bg-current/10 font-medium" : "opacity-70 hover:opacity-100",
              )}
            >
              {locale.toUpperCase()}
              <span className="sr-only"> {LOCALE_NAMES[locale]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
