import Link from "next/link";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { AGENCY_NAME } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { sendEnquiry } from "@/app/[locale]/(pages)/enquiry-actions";
import { ContactDialog } from "./contact-dialog";
import { LanguageSwitcher } from "./language-switcher";
import { MobileMenu, NavLinks, type NavLink } from "./site-nav";

/**
 * The site header in two looks, chosen by the layout that renders it:
 * - `solid`: a sticky cream bar, for every page in the `(pages)` route group;
 * - `overlay`: transparent with white text, placed over the home page's photo banner.
 * Each layout renders its own header, so the look never depends on what else is in the DOM.
 */
export function SiteHeader({
  locale,
  variant = "solid",
}: {
  locale: Locale;
  variant?: "solid" | "overlay";
}) {
  const dictionary = getDictionary(locale);
  const h = dictionary.header;
  const links: NavLink[] = [
    {
      href: `/${locale}/homes?operation=sale`,
      label: h.buy,
      match: { path: `/${locale}/homes`, operation: "sale" },
    },
    {
      href: `/${locale}/homes?operation=rent`,
      label: h.rent,
      match: { path: `/${locale}/homes`, operation: "rent" },
    },
    { href: `/${locale}/about`, label: h.about, match: { path: `/${locale}/about` } },
    { href: `/${locale}/contact`, label: h.contact, match: { path: `/${locale}/contact` } },
  ];

  return (
    <header
      className={cn(
        "z-30 w-full",
        variant === "solid"
          ? "border-line bg-canvas/95 text-ink sticky top-0 border-b backdrop-blur"
          : "absolute inset-x-0 top-0 text-white",
      )}
    >
      {/* Three columns, so the menu sits in the true centre whatever the width of the sides. */}
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-6 px-5 py-5 sm:px-8 lg:grid-cols-[1fr_auto_1fr]">
        <Link
          href={`/${locale}`}
          className="font-display justify-self-start text-2xl leading-none font-medium whitespace-nowrap"
        >
          {AGENCY_NAME}
        </Link>

        <nav aria-label={h.menu} className="hidden lg:block">
          <Suspense fallback={<NavLinks links={links} static />}>
            <NavLinks links={links} />
          </Suspense>
        </nav>

        <div className="flex items-center gap-3 justify-self-end">
          <div className="hidden sm:block">
            <Suspense fallback={<div className="h-8 w-28" />}>
              <LanguageSwitcher current={locale} label={h.language} />
            </Suspense>
          </div>

          <ContactDialog
            action={sendEnquiry.bind(null, null)}
            label={h.contactUs}
            closeLabel={h.close}
            title={dictionary.contact.formTitle}
            intro={dictionary.enquiry.intro}
            defaultMessage={dictionary.contact.messageDefault}
            t={dictionary.enquiry}
            className={cn(
              "flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors sm:px-4",
              variant === "solid"
                ? "bg-accent hover:bg-accent-strong text-white"
                : "text-ink bg-white hover:bg-white/90",
            )}
          />

          <MobileMenu label={h.menu}>
            <nav aria-label={h.menu}>
              <Suspense fallback={<NavLinks links={links} static stacked />}>
                <NavLinks links={links} stacked />
              </Suspense>
            </nav>
            <div className="border-line mt-2 border-t px-1 pt-3 pb-1 sm:hidden">
              <Suspense>
                <LanguageSwitcher current={locale} label={h.language} />
              </Suspense>
            </div>
          </MobileMenu>
        </div>
      </div>
    </header>
  );
}
