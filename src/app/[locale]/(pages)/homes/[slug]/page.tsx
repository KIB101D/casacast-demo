import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { PhotoPlaceholder } from "@/components/site/photo-placeholder";
import { INTL_LOCALE, LOCALES, plural, type Locale } from "@/i18n/config";
import { fill, getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { formatArea, formatEuros } from "@/i18n/format";
import { currentLocale } from "@/i18n/server";
import { filtersToQuery } from "@/lib/catalog/filters";
import { getListing, type ListingDetail } from "@/lib/catalog/queries";
import { referenceFromSlug } from "@/lib/catalog/slug";
import { photoUrl } from "@/lib/photos/url";
import { siteUrl } from "@/lib/site-url";
import { EnquiryForm } from "@/components/site/enquiry-form";
import { sendEnquiry } from "../../enquiry-actions";
import { AreaMap } from "@/components/site/area-map";
import { getOwnListingPreview } from "@/demo/preview";
import { DemoPreviewNotice } from "@/demo/preview-notice";
import { Gallery } from "./gallery";

type Props = PageProps<"/[locale]/homes/[slug]">;

async function loadListing(params: Props["params"]) {
  const [{ slug }, locale] = await Promise.all([params, currentLocale()]);
  const reference = referenceFromSlug(slug);
  const listing = reference ? await getListing(reference, locale) : null;
  // Demo version: a sandbox also sees its own listings here (only it, never cached or indexed).
  const preview = !listing && reference ? await getOwnListingPreview(reference, locale) : null;
  return { slug, locale, listing: listing ?? preview, isPreview: preview !== null };
}

function summary(text: string, max = 155) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, listing, isPreview } = await loadListing(params);
  if (!listing) return {};
  if (isPreview) return { title: listing.title, robots: { index: false, follow: false } };

  const path = (l: Locale) => `/${l}/homes/${listing.slug}`;
  const cover = listing.photos[0];
  return {
    title: listing.title,
    description: summary(listing.description),
    alternates: {
      canonical: path(locale),
      languages: Object.fromEntries(LOCALES.map((l) => [l, path(l)])),
    },
    openGraph: {
      type: "website",
      title: listing.title,
      description: summary(listing.description),
      images: cover
        ? [{ url: photoUrl(cover.url, { width: 1200, height: 630 }), width: 1200, height: 630 }]
        : [],
    },
    // A sold home stays reachable for old links, but drops out of search results.
    robots: listing.status === "sold" ? { index: false, follow: true } : undefined,
  };
}

export default function ListingPage({ params }: Props) {
  return (
    <Suspense fallback={<ListingSkeleton />}>
      <Listing params={params} />
    </Suspense>
  );
}

async function Listing({ params }: { params: Props["params"] }) {
  const { slug, locale, listing, isPreview } = await loadListing(params);
  if (!listing) notFound();
  // Old or hand-typed slugs redirect to the current one, so each home has a single URL.
  if (slug !== listing.slug) permanentRedirect(`/${locale}/homes/${listing.slug}`);

  const dict = getDictionary(locale);
  const t = dict.listing;
  const similarQuery = filtersToQuery({ type: listing.type, operation: listing.operation });

  const price = (
    <>
      {formatEuros(listing.price, locale)}
      {listing.operation === "rent" ? (
        <span className="text-muted ml-1.5 text-lg font-normal">{dict.perMonth}</span>
      ) : null}
    </>
  );
  // Buyers compare homes by price per square metre; for rentals it means little.
  const perSqm =
    listing.operation === "sale" && listing.area > 0
      ? `${new Intl.NumberFormat(INTL_LOCALE[locale]).format(Math.round(listing.price / listing.area))} ${t.perSqm}`
      : null;

  return (
    <main className="mx-auto max-w-7xl px-5 pt-6 sm:px-8">
      <JsonLd listing={listing} locale={locale} />

      <Link href={`/${locale}/homes`} className="text-muted hover:text-ink text-sm">
        <span aria-hidden>‹ </span>
        {t.back}
      </Link>

      {isPreview ? (
        <DemoPreviewNotice
          title={dict.demo.previewTitle}
          body={dict.demo.previewBody}
          closeLabel={dict.demo.close}
        />
      ) : null}

      {listing.status === "sold" ? (
        <div role="status" className="bg-sal-soft mt-4 rounded-lg px-5 py-4">
          <p className="font-medium">{t.soldTitle}</p>
          <p className="text-muted mt-1 text-sm">
            {t.soldBody}{" "}
            <Link
              href={`/${locale}/homes${similarQuery}`}
              className="text-accent underline underline-offset-4"
            >
              {dict.header.home}
            </Link>
          </p>
        </div>
      ) : null}

      {/* Two columns from the top: the home on the left, price and the enquiry card on the right,
          which stays in view while the left side scrolls. */}
      <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
        <article className="min-w-0">
          <header>
            <p className="text-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="plaque">{listing.town}</span>
              <span>{listing.province}</span>
              <span aria-hidden>·</span>
              <span>
                {dict.propertyTypes[listing.type]},{" "}
                {dict.operations[listing.operation].toLowerCase()}
              </span>
            </p>
            <h1 className="font-display text-ink mt-3 text-3xl leading-tight font-medium text-balance sm:text-4xl">
              {listing.title}
            </h1>
            <KeyFacts listing={listing} locale={locale} dict={dict} />
            {/* On phones the side card comes after everything, so the price shows here too. */}
            <div className="mt-4 lg:hidden">
              <p className="text-3xl font-semibold tabular-nums">{price}</p>
              {perSqm ? <p className="text-muted mt-0.5 text-sm tabular-nums">{perSqm}</p> : null}
            </div>
          </header>

          <div className="mt-5">
            {listing.photos.length > 0 ? (
              <Gallery
                photos={listing.photos}
                title={listing.title}
                labels={{
                  gallery: t.gallery,
                  previous: t.previous,
                  next: t.next,
                  counter: t.photoCounter,
                  showPhoto: t.showPhoto,
                  showAll: t.showAll,
                  close: t.closeGallery,
                }}
              />
            ) : (
              <div className="aspect-[3/2] overflow-hidden rounded-md">
                <PhotoPlaceholder label={dict.card.photosSoon} />
              </div>
            )}
          </div>

          <div className="mt-10">
            <Facts listing={listing} locale={locale} dict={dict} />
          </div>

          <section className="mt-12" aria-labelledby="description-heading">
            <h2 id="description-heading" className="font-display text-2xl">
              {t.description}
            </h2>
            {listing.textLocale !== locale ? (
              <p className="bg-canvas text-muted mt-3 rounded px-3 py-2 text-sm">
                {t.fallbackNote}
              </p>
            ) : null}
            <div
              lang={listing.textLocale}
              className="text-ink mt-4 max-w-prose leading-relaxed whitespace-pre-line"
            >
              {listing.description}
            </div>
          </section>

          {listing.latitude !== null && listing.longitude !== null ? (
            <section className="mt-12" aria-labelledby="location-heading">
              <h2 id="location-heading" className="font-display text-2xl">
                {t.location}
              </h2>
              <p className="text-muted mt-1 mb-4 text-sm">
                {listing.town}, {listing.province}. {t.mapNote}
              </p>
              <AreaMap
                latitude={listing.latitude}
                longitude={listing.longitude}
                label={t.mapLabel}
              />
            </section>
          ) : null}
        </article>

        {/* Below the sticky site header, which is about 5rem tall. */}
        <aside
          aria-labelledby={listing.status === "active" ? "enquiry-heading" : undefined}
          aria-label={listing.status === "active" ? undefined : t.price}
          className="lg:sticky lg:top-24 lg:self-start"
        >
          {/* On short screens the card scrolls on its own, so the button is always reachable. */}
          <div className="border-line bg-surface rounded-md border shadow-sm lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
            <div
              className={
                listing.status === "active" ? "border-line border-b px-6 py-4" : "px-6 py-4"
              }
            >
              <p className="text-3xl font-semibold tabular-nums">{price}</p>
              <p className="text-muted mt-1 text-sm">
                {perSqm ? <span className="tabular-nums">{perSqm} · </span> : null}
                {t.reference} <span className="font-mono">{listing.reference}</span>
              </p>
            </div>
            {listing.status === "active" ? (
              <div className="px-6 pt-5 pb-6">
                <h2 id="enquiry-heading" className="font-display text-2xl">
                  {dict.enquiry.title}
                </h2>
                <p className="text-muted mt-1 mb-4 text-sm">{dict.enquiry.intro}</p>
                <EnquiryForm
                  messageRows={3}
                  action={sendEnquiry.bind(null, listing.id)}
                  t={dict.enquiry}
                  defaultMessage={fill(dict.enquiry.messageDefault, {
                    reference: listing.reference,
                  })}
                />
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  );
}

/** The one-line summary under the title: bedrooms, bathrooms, areas. */
function KeyFacts({
  listing,
  locale,
  dict,
}: {
  listing: ListingDetail;
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.listing;
  const items = [
    listing.bedrooms > 0
      ? { icon: <BedIcon />, text: plural(locale, listing.bedrooms, dict.card.bedrooms) }
      : null,
    listing.bathrooms > 0
      ? { icon: <BathIcon />, text: plural(locale, listing.bathrooms, dict.card.bathrooms) }
      : null,
    {
      icon: <AreaIcon />,
      text:
        listing.type === "land"
          ? `${t.plot} ${formatArea(listing.area, locale)}`
          : formatArea(listing.area, locale),
    },
    listing.plotArea
      ? { icon: <PlotIcon />, text: `${t.plot} ${formatArea(listing.plotArea, locale)}` }
      : null,
  ].filter((item) => item !== null);

  return (
    <ul className="text-ink mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[0.95rem]">
      {items.map((item) => (
        <li key={item.text} className="flex items-center gap-1.5">
          <span className="text-accent" aria-hidden>
            {item.icon}
          </span>
          {item.text}
        </li>
      ))}
    </ul>
  );
}

const iconProps = {
  viewBox: "0 0 20 20",
  className: "size-[1.1rem]",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function BedIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2.5 15.5v-9M2.5 12.5h15v3M17.5 12.5V10a2 2 0 0 0-2-2h-6v4.5" />
      <circle cx="6" cy="9.5" r="1.5" />
    </svg>
  );
}

function BathIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 10h14v2a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-2ZM5 10V5a1.5 1.5 0 0 1 3 0M6 16l-1 1.5M14 16l1 1.5" />
    </svg>
  );
}

function AreaIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="3" width="14" height="14" rx="1" />
      <path d="M7 3v3M3 7h3M13 17v-3M17 13h-3" />
    </svg>
  );
}

function PlotIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2.5 15.5 7 4.5l4 6 2.5-3 4 8Z" />
      <path d="M2.5 15.5h15" />
    </svg>
  );
}

function Facts({
  listing,
  locale,
  dict,
}: {
  listing: ListingDetail;
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.listing;
  const number = new Intl.NumberFormat(INTL_LOCALE[locale]);
  const rows: [string, string][] = [
    [
      t.type,
      `${dict.propertyTypes[listing.type]}, ${dict.operations[listing.operation].toLowerCase()}`,
    ],
    ...(listing.bedrooms > 0
      ? [[t.bedrooms, number.format(listing.bedrooms)] as [string, string]]
      : []),
    ...(listing.bathrooms > 0
      ? [[t.bathrooms, number.format(listing.bathrooms)] as [string, string]]
      : []),
    // For land the area is the plot; houses may have a plot as well.
    [listing.type === "land" ? t.plot : t.area, formatArea(listing.area, locale)],
    ...(listing.plotArea
      ? [[t.plot, formatArea(listing.plotArea, locale)] as [string, string]]
      : []),
    [t.reference, listing.reference],
  ];

  return (
    <section aria-labelledby="facts-heading">
      <h2 id="facts-heading" className="font-display text-2xl">
        {t.facts}
      </h2>
      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="bg-surface border-line rounded-md border px-4 py-3">
            <dt className="text-muted text-xs">{label}</dt>
            <dd className="mt-0.5 font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** schema.org markup so search engines can show price and photos in results. */
function JsonLd({ listing, locale }: { listing: ListingDetail; locale: Locale }) {
  const url = new URL(`/${locale}/homes/${listing.slug}`, siteUrl()).toString();
  const data = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: listing.title,
    description: summary(listing.description, 300),
    url,
    inLanguage: listing.textLocale,
    dateModified: listing.updatedAt,
    image: listing.photos
      .slice(0, 5)
      .map((p) => new URL(photoUrl(p.url, { width: 1200 }), siteUrl()).toString()),
    offers: {
      "@type": "Offer",
      price: listing.price,
      priceCurrency: "EUR",
      availability:
        listing.status === "active" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      businessFunction:
        listing.operation === "rent"
          ? "http://purl.org/goodrelations/v1#LeaseOut"
          : "http://purl.org/goodrelations/v1#Sell",
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: listing.town,
      addressRegion: listing.province,
      addressCountry: "ES",
    },
  };

  return (
    <script
      type="application/ld+json"
      // `<` is escaped so a title like "</script>" can't break out of the tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

function ListingSkeleton() {
  return (
    <div aria-hidden className="mx-auto max-w-7xl animate-pulse px-5 pt-8 sm:px-8">
      <div className="bg-canvas h-4 w-24 rounded" />
      <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
        <div>
          <div className="bg-canvas h-10 w-2/3 rounded" />
          <div className="bg-canvas mt-5 aspect-[3/2] rounded-md" />
        </div>
        <div className="bg-canvas hidden h-[560px] rounded-md lg:block" />
      </div>
    </div>
  );
}
