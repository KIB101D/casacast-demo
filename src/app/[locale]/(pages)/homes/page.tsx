import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CatalogFiltersForm } from "@/components/site/catalog-filters";
import { ListingCard } from "@/components/site/listing-card";
import { listOwnListingPreviews } from "@/demo/preview";
import { LOCALES, plural } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/server";
import { parseFilters } from "@/lib/catalog/filters";
import { listTowns, searchListings } from "@/lib/catalog/queries";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const dict = getDictionary(locale);
  return {
    title: dict.meta.homeTitle,
    description: dict.meta.homeDescription,
    alternates: {
      canonical: `/${locale}/homes`,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}/homes`])),
    },
    openGraph: { title: dict.meta.homeTitle, description: dict.meta.homeDescription },
  };
}

export default async function CatalogPage({ searchParams }: PageProps<"/[locale]/homes">) {
  const locale = await currentLocale();
  const dict = getDictionary(locale);

  return (
    <main className="mx-auto max-w-7xl px-5 sm:px-8">
      <section className="pt-12 pb-8 sm:pt-16">
        <h1 className="font-display text-ink text-4xl font-medium sm:text-5xl">
          {dict.header.home}
        </h1>
        <p className="text-muted mt-3 max-w-xl">{dict.hero.lead}</p>
      </section>

      {/* Filters and results depend on the URL query, so they stream in after the static hero. */}
      <Suspense fallback={<CatalogSkeleton />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Catalog({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/homes">["searchParams"];
}) {
  const locale = await currentLocale();
  const dict = getDictionary(locale);
  const filters = parseFilters(await searchParams);
  const [agencyListings, own, towns] = await Promise.all([
    searchListings(filters, locale),
    // Demo version: the visitor's own demo listings come first, tagged "Demo", for them only.
    listOwnListingPreviews(filters, locale),
    listTowns(),
  ]);
  const ownReferences = new Set(own.map((l) => l.reference));
  const listings = [...own, ...agencyListings];

  return (
    <>
      <section className="border-line bg-surface rounded-md border p-4 sm:p-6">
        <CatalogFiltersForm
          key={JSON.stringify(filters)}
          locale={locale}
          dict={dict}
          filters={filters}
          towns={towns}
        />
      </section>

      <section aria-labelledby="results-heading" className="mt-10">
        <h2 id="results-heading" className="text-muted mb-6 text-sm" aria-live="polite">
          {plural(locale, listings.length, dict.results.count)}
        </h2>

        {listings.length === 0 ? (
          <div className="border-line rounded-lg border border-dashed px-6 py-14 text-center">
            <p className="font-display text-2xl">{dict.results.emptyTitle}</p>
            <p className="text-muted mt-2">{dict.results.emptyHint}</p>
            <Link
              href={`/${locale}/homes`}
              className="text-accent mt-4 inline-block underline underline-offset-4"
            >
              {dict.filters.reset}
            </Link>
          </div>
        ) : (
          <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing, index) => (
              <li key={listing.reference}>
                <ListingCard
                  listing={listing}
                  locale={locale}
                  dict={dict}
                  priority={index < 3}
                  tag={
                    ownReferences.has(listing.reference)
                      ? { label: dict.demo.badge, hint: dict.demo.badgeHint }
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function CatalogSkeleton() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="bg-canvas h-40 rounded-lg" />
      <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <div className="bg-canvas aspect-[4/3] rounded-md" />
            <div className="bg-canvas h-5 w-1/3 rounded" />
            <div className="bg-canvas h-4 w-2/3 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
