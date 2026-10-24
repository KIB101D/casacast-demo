import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PhotoImage } from "@/components/photo-image";
import { ContactCta } from "@/components/site/contact-cta";
import { HeroSearch } from "@/components/site/hero-search";
import { ListingCard } from "@/components/site/listing-card";
import { SiteHeader } from "@/components/site/site-header";
import { LOCALES, plural, type Locale } from "@/i18n/config";
import { fill, getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/server";
import { AGENCY_NAME } from "@/lib/constants";
import { getHeroListing, listTownStats, listTowns, searchListings } from "@/lib/catalog/queries";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const dict = getDictionary(locale);
  return {
    title: { absolute: `${dict.hero.title} · ${AGENCY_NAME}` },
    description: dict.meta.homeDescription,
    alternates: {
      canonical: `/${locale}`,
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])),
        "x-default": "/",
      },
    },
    openGraph: { title: dict.hero.title, description: dict.meta.homeDescription },
  };
}

export default async function HomePage() {
  const locale = await currentLocale();
  const dict = getDictionary(locale);
  const [hero, towns, latest, townStats] = await Promise.all([
    getHeroListing(locale),
    listTowns(),
    searchListings({ sort: "newest" }, locale),
    listTownStats(),
  ]);

  return (
    <main>
      <Hero locale={locale} dict={dict} hero={hero} towns={towns} />

      <section aria-labelledby="featured-heading" className="mx-auto max-w-7xl px-5 pt-24 sm:px-8">
        <SectionHeading
          id="featured-heading"
          title={dict.home.featuredTitle}
          lead={dict.home.featuredLead}
          link={{ href: `/${locale}/homes`, label: dict.hero.viewAll }}
        />
        <ul className="mt-10 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {latest.slice(0, 6).map((listing) => (
            <li key={listing.reference}>
              <ListingCard listing={listing} locale={locale} dict={dict} />
            </li>
          ))}
        </ul>
      </section>

      <section
        id="towns"
        aria-labelledby="towns-heading"
        className="mx-auto max-w-7xl scroll-mt-24 px-5 pt-28 sm:px-8"
      >
        <SectionHeading
          id="towns-heading"
          title={dict.home.townsTitle}
          lead={dict.home.townsLead}
        />
        <ul className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {townStats.slice(0, 8).map((town) => (
            <li key={town.town}>
              <Link
                href={`/${locale}/homes?town=${encodeURIComponent(town.town)}`}
                className="group bg-canvas relative block aspect-[4/5] overflow-hidden rounded-sm"
              >
                {town.coverUrl ? (
                  <PhotoImage
                    src={town.coverUrl}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 300px, (min-width: 768px) 33vw, 50vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                ) : null}
                {town.coverUrl ? (
                  <>
                    <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <span className="absolute inset-x-0 bottom-0 p-4 text-white">
                      <span className="font-display block text-2xl leading-tight">{town.town}</span>
                      <span className="text-sm text-white/80">
                        {plural(locale, town.count, dict.home.townCount)}
                      </span>
                    </span>
                  </>
                ) : (
                  // No photo yet: a sand-coloured tile with the town's street plaque.
                  <span className="bg-sal-soft group-hover:bg-sal absolute inset-0 flex flex-col items-center justify-center gap-3 transition-colors">
                    <span className="plaque plaque-lg">{town.town}</span>
                    <span className="text-muted text-sm">
                      {plural(locale, town.count, dict.home.townCount)}
                    </span>
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="about-heading" className="mx-auto max-w-7xl px-5 pt-28 sm:px-8">
        <div className="border-line grid gap-12 border-t pt-16 lg:grid-cols-2">
          <div>
            <h2 id="about-heading" className="font-display text-4xl leading-tight sm:text-5xl">
              {dict.home.aboutTitle}
            </h2>
            <p className="text-muted mt-6 max-w-lg text-lg leading-relaxed">
              {dict.home.aboutBody}
            </p>
            <Link
              href={`/${locale}/about`}
              className="text-accent mt-8 inline-block font-medium underline underline-offset-8"
            >
              {dict.home.aboutLink}
            </Link>
          </div>
          <ol className="flex flex-col">
            {dict.about.steps.map((step, i) => (
              <li key={step.title} className="border-line flex gap-6 border-b py-5 first:pt-0">
                <span className="font-display text-accent w-8 shrink-0 text-2xl">{i + 1}</span>
                <span>
                  <span className="block font-medium">{step.title}</span>
                  <span className="text-muted mt-1 block text-sm leading-relaxed">{step.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <ContactCta locale={locale} dict={dict} />
    </main>
  );
}

function Hero({
  locale,
  dict,
  hero,
  towns,
}: {
  locale: Locale;
  dict: Dictionary;
  hero: Awaited<ReturnType<typeof getHeroListing>>;
  towns: string[];
}) {
  return (
    <section className="bg-ink relative flex min-h-[max(640px,min(92svh,880px))] items-end overflow-hidden pt-28 text-white">
      {hero?.cover ? (
        <PhotoImage
          src={hero.cover.url}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 70% 20%, #b4532a 0%, transparent 55%), radial-gradient(ellipse at 20% 90%, #933f1d 0%, transparent 50%), #2b231d",
          }}
        />
      )}
      {/* Darker at the top for the header and at the bottom for the headline and search. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/15 to-black/75"
      />

      {/* The home page draws its own header, transparent over the photo. */}
      <SiteHeader locale={locale} variant="overlay" />

      <div className="relative mx-auto w-full max-w-7xl px-5 pb-10 sm:px-8 sm:pb-14">
        <h1 className="font-display max-w-3xl text-5xl leading-[1.02] font-medium sm:text-7xl">
          {dict.hero.title}
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/85">{dict.hero.lead}</p>

        <div className="mt-10 max-w-5xl">
          <Suspense>
            <HeroSearch locale={locale} dict={dict} towns={towns} />
          </Suspense>
        </div>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-4 text-sm">
          <Link
            href={`/${locale}/homes`}
            className="font-medium underline decoration-white/50 underline-offset-8 hover:decoration-white"
          >
            {dict.hero.viewAll}
          </Link>
          {hero ? (
            <Link href={`/${locale}/homes/${hero.slug}`} className="text-white/70 hover:text-white">
              {fill(dict.hero.pictured, { title: hero.title, town: hero.town })}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  id,
  title,
  lead,
  link,
}: {
  id: string;
  title: string;
  lead: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 id={id} className="font-display text-4xl leading-tight sm:text-5xl">
          {title}
        </h2>
        <p className="text-muted mt-3 max-w-xl">{lead}</p>
      </div>
      {link ? (
        <Link
          href={link.href}
          className="text-accent shrink-0 font-medium underline underline-offset-8"
        >
          {link.label}
        </Link>
      ) : null}
    </div>
  );
}
