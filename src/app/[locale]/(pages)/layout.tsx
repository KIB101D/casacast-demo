import { SiteHeader } from "@/components/site/site-header";
import { layoutLocale } from "@/i18n/server";

/**
 * Route group for every public page except the home page: catalogue, listing, about, contact.
 * The group adds no URL segment; it only gives these pages the solid, sticky header.
 */
export default async function PagesLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await layoutLocale();
  return (
    <>
      <SiteHeader locale={locale} />
      {children}
    </>
  );
}
