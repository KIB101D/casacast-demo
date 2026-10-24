import type { Metadata } from "next";
import { ContactCta } from "@/components/site/contact-cta";
import { LOCALES } from "@/i18n/config";
import { fill, getDictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/server";
import { AGENCY_NAME } from "@/lib/constants";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const t = getDictionary(locale).about;
  return {
    title: t.metaTitle,
    description: fill(t.intro[0]!, { agency: AGENCY_NAME }),
    alternates: {
      canonical: `/${locale}/about`,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}/about`])),
    },
  };
}

export default async function AboutPage() {
  const locale = await currentLocale();
  const dict = getDictionary(locale);
  const t = dict.about;

  return (
    <main>
      {/* Two independent columns; on wide screens the heading sits in the middle of its own,
          on both axes. On phones it stacks above the text, left-aligned like it. */}
      <section className="mx-auto grid max-w-7xl gap-8 px-5 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-2 lg:gap-12">
        <div className="flex lg:items-center lg:justify-center">
          <h1 className="font-display text-5xl leading-[1.05] font-medium sm:text-6xl">
            {t.title}
          </h1>
        </div>
        <div className="flex flex-col gap-5 text-lg leading-relaxed">
          {t.intro.map((paragraph) => (
            <p key={paragraph}>{fill(paragraph, { agency: AGENCY_NAME })}</p>
          ))}
        </div>
      </section>

      <ContactCta locale={locale} dict={dict} />
    </main>
  );
}
