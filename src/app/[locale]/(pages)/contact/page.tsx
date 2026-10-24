import type { Metadata } from "next";
import { AreaMap } from "@/components/site/area-map";
import { EnquiryForm } from "@/components/site/enquiry-form";
import { LOCALES } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/server";
import { AGENCY_CONTACT } from "@/lib/constants";
import { sendEnquiry } from "../enquiry-actions";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const t = getDictionary(locale).contact;
  return {
    title: t.metaTitle,
    description: t.lead,
    alternates: {
      canonical: `/${locale}/contact`,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}/contact`])),
    },
  };
}

export default async function ContactPage() {
  const locale = await currentLocale();
  const dict = getDictionary(locale);
  const t = dict.contact;

  const contacts = [
    {
      label: t.phone,
      value: AGENCY_CONTACT.phone,
      href: `tel:${AGENCY_CONTACT.phone.replace(/\s/g, "")}`,
    },
    { label: t.email, value: AGENCY_CONTACT.email, href: `mailto:${AGENCY_CONTACT.email}` },
    { label: t.office, value: t.officeValue },
    { label: t.hours, value: t.hoursValue },
  ];

  return (
    <main className="mx-auto grid max-w-7xl gap-12 px-5 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[1fr_440px]">
      <div>
        <h1 className="font-display text-5xl leading-[1.05] font-medium sm:text-6xl">{t.title}</h1>
        <p className="text-muted mt-5 max-w-xl text-lg leading-relaxed">{t.lead}</p>

        <dl className="mt-10 grid gap-6 sm:grid-cols-2">
          {contacts.map((item) => (
            <div key={item.label}>
              <dt className="text-muted text-sm">{item.label}</dt>
              <dd className="mt-1 text-lg">
                {item.href ? (
                  <a
                    href={item.href}
                    className="hover:text-accent underline-offset-4 hover:underline"
                  >
                    {item.value}
                  </a>
                ) : (
                  item.value
                )}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-10">
          <AreaMap
            latitude={AGENCY_CONTACT.latitude}
            longitude={AGENCY_CONTACT.longitude}
            label={t.mapLabel}
            radius={250}
            zoom={15}
          />
        </div>
      </div>

      <div className="border-line bg-surface self-start rounded-md border p-6 sm:p-8 lg:sticky lg:top-28">
        <h2 className="font-display text-3xl">{t.formTitle}</h2>
        <p className="text-muted mt-1 mb-6 text-sm">{dict.enquiry.intro}</p>
        <EnquiryForm
          action={sendEnquiry.bind(null, null)}
          t={dict.enquiry}
          defaultMessage={t.messageDefault}
        />
      </div>
    </main>
  );
}
