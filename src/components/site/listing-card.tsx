import Link from "next/link";
import { PhotoImage } from "@/components/photo-image";
import { plural, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatArea, formatEuros } from "@/i18n/format";
import type { ListingCard as Card } from "@/lib/catalog/queries";
import { PhotoPlaceholder } from "./photo-placeholder";

export function ListingCard({
  listing,
  locale,
  dict,
  priority = false,
  tag,
}: {
  listing: Card;
  locale: Locale;
  dict: Dictionary;
  priority?: boolean;
  /** An extra label over the photo, e.g. "Demo" on a visitor's own demo listing. */
  tag?: { label: string; hint: string };
}) {
  const href = `/${locale}/homes/${listing.slug}`;
  const facts = [
    listing.bedrooms > 0 ? plural(locale, listing.bedrooms, dict.card.bedrooms) : null,
    listing.bathrooms > 0 ? plural(locale, listing.bathrooms, dict.card.bathrooms) : null,
    formatArea(listing.area, locale),
  ].filter(Boolean);

  return (
    <article className="group relative flex flex-col gap-3">
      <div className="bg-surface relative aspect-[4/3] overflow-hidden rounded-sm">
        {listing.cover ? (
          <PhotoImage
            src={listing.cover.url}
            alt=""
            fill
            priority={priority}
            sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <PhotoPlaceholder label={dict.card.photosSoon} />
        )}
        {tag || listing.operation === "rent" ? (
          <div className="absolute top-3 left-3 flex gap-1.5">
            {tag ? (
              <span
                title={tag.hint}
                className="bg-accent rounded-sm px-2 py-0.5 text-xs font-medium text-white"
              >
                {tag.label}
                <span className="sr-only">. {tag.hint}</span>
              </span>
            ) : null}
            {listing.operation === "rent" ? (
              <span className="bg-sal text-ink rounded-sm px-2 py-0.5 text-xs font-medium">
                {dict.operations.rent}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-ink text-xl font-semibold tabular-nums">
          {formatEuros(listing.price, locale)}
          {listing.operation === "rent" ? (
            <span className="text-muted ml-1 text-base font-normal">{dict.perMonth}</span>
          ) : null}
        </p>
        <h3 className="text-ink leading-snug">
          {/* The whole card is clickable through this link's ::after, keeping one link per card. */}
          <Link
            href={href}
            className="decoration-sal decoration-2 underline-offset-4 group-hover:underline after:absolute after:inset-0"
          >
            {listing.title}
          </Link>
        </h3>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="plaque">{listing.town}</span>
          <ul className="text-muted flex flex-wrap gap-x-3">
            {facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}
