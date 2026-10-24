import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import { getDictionary } from "@/i18n/dictionaries";
import { layoutLocale } from "@/i18n/server";

export default async function NotFound() {
  const locale = await layoutLocale();
  const t = getDictionary(locale).notFound;

  // Rendered in place of the route group, so it brings its own header.
  return (
    <>
      <SiteHeader locale={locale} />
      <main className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <h1 className="font-display text-5xl">{t.title}</h1>
        <p className="text-muted mt-4 max-w-md text-lg">{t.body}</p>
        <Link
          href={`/${locale}/homes`}
          className="bg-accent hover:bg-accent-strong mt-8 inline-block rounded-md px-5 py-2.5 text-sm font-medium text-white"
        >
          {t.link}
        </Link>
      </main>
    </>
  );
}
