import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

/** The terracotta "talk to us" band, at the end of the home and about pages. */
export function ContactCta({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <section className="mx-auto max-w-7xl px-5 pt-28 sm:px-8">
      <div className="bg-accent flex flex-col gap-6 rounded-md px-8 py-12 text-white sm:px-12 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-display text-3xl sm:text-4xl">{dict.home.ctaTitle}</h2>
          <p className="mt-3 max-w-xl text-white/85">{dict.home.ctaBody}</p>
        </div>
        <Link
          href={`/${locale}/contact`}
          className="text-accent-strong hover:bg-canvas shrink-0 rounded-sm bg-white px-7 py-3 text-center font-medium transition-colors"
        >
          {dict.home.ctaButton}
        </Link>
      </div>
    </section>
  );
}
