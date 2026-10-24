import "@fontsource-variable/alegreya";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import Link from "next/link";
import { LOCALES } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { layoutLocale } from "@/i18n/server";
import { AGENCY_CONTACT, AGENCY_NAME } from "@/lib/constants";
import { siteUrl } from "@/lib/site-url";
import "../globals.css";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await layoutLocale();
  const dict = getDictionary(locale);
  return {
    metadataBase: siteUrl(),
    title: { default: AGENCY_NAME, template: `%s · ${AGENCY_NAME}` },
    description: dict.meta.homeDescription,
    openGraph: { siteName: AGENCY_NAME, locale },
  };
}

/**
 * The public site's root layout: document, fonts and footer. The header is not here: the home
 * page draws it over its banner, and the `(pages)` route group layout draws the solid one.
 */
export default async function SiteLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await layoutLocale();
  const dict = getDictionary(locale);
  const h = dict.header;

  const links = [
    { href: `/${locale}/homes?operation=sale`, label: h.buy },
    { href: `/${locale}/homes?operation=rent`, label: h.rent },
    { href: `/${locale}/about`, label: h.about },
    { href: `/${locale}/contact`, label: h.contact },
  ];

  return (
    <html lang={locale} className={`theme-site ${GeistSans.variable} antialiased`}>
      <body className="bg-canvas text-ink flex min-h-screen flex-col font-sans">
        <div className="flex-1">{children}</div>

        <footer className="bg-ink mt-24 text-white/80">
          {/* Name and blurb on the left; menu and contacts on the right, centred on both axes
              against the left block. */}
          <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-stretch md:justify-between">
            <div className="max-w-sm">
              <p className="font-display text-2xl leading-none text-white">{AGENCY_NAME}</p>
              <p className="mt-3 text-sm leading-relaxed">{dict.home.aboutBody}</p>
            </div>

            <div className="flex flex-col gap-4 py-1 text-sm md:items-center md:justify-center md:self-center md:text-center">
              <nav aria-label={h.menu}>
                <ul className="flex flex-wrap gap-x-8 gap-y-2 md:justify-center">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-white hover:underline">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <address className="flex flex-wrap gap-x-8 gap-y-2 not-italic md:justify-center">
                <a
                  href={`tel:${AGENCY_CONTACT.phone.replace(/\s/g, "")}`}
                  className="hover:text-white"
                >
                  {AGENCY_CONTACT.phone}
                </a>
                <a href={`mailto:${AGENCY_CONTACT.email}`} className="hover:text-white">
                  {AGENCY_CONTACT.email}
                </a>
                <span>{dict.contact.officeValue}</span>
              </address>
            </div>
          </div>

          <div className="border-t border-white/10">
            <div className="mx-auto flex max-w-7xl justify-end px-5 py-5 text-xs text-white/60 sm:px-8">
              <Link href="/admin" className="shrink-0 hover:text-white">
                {dict.footer.backOffice}
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
