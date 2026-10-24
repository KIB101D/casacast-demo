"use client";

import { createContext, use, useEffect, type ReactNode } from "react";
import { adminI18n, type AdminI18n, type AdminLocale } from ".";

const AdminI18nContext = createContext<AdminI18n>(adminI18n("en"));

/**
 * Gives client components the back-office language. Only the locale crosses from the server; the
 * dictionaries are imported here, so their functions don't need serialising.
 */
export function AdminI18nProvider({
  locale,
  children,
}: {
  locale: AdminLocale;
  children: ReactNode;
}) {
  // The <html> element belongs to the shared back-office layout, which can't read cookies.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <AdminI18nContext value={adminI18n(locale)}>{children}</AdminI18nContext>;
}

export function useAdminI18n() {
  return use(AdminI18nContext);
}
