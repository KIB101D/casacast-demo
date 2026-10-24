import { Suspense } from "react";
import { AdminLanguageSwitcher } from "@/components/admin/language-switcher";
import { AdminI18nProvider } from "@/i18n/admin/client";
import { adminTitle, getAdminI18n } from "@/i18n/admin/server";
import { AGENCY_NAME } from "@/lib/constants";
import { adminSignInEnabled } from "@/demo/admin";
import { LoginForm } from "./login-form";

export const generateMetadata = adminTitle("signIn");

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Suspense fallback={<div className="h-[420px]" />}>
          <LoginScreen />
        </Suspense>
      </div>
    </main>
  );
}

async function LoginScreen() {
  const { locale, t } = await getAdminI18n();
  return (
    <AdminI18nProvider locale={locale}>
      <div lang={locale}>
        <div className="mb-8 text-center">
          <p className="text-accent text-sm font-medium tracking-wide uppercase">{AGENCY_NAME}</p>
          <h1 className="mt-2 text-2xl font-semibold">{t.login.title}</h1>
        </div>
        <LoginForm adminEnabled={adminSignInEnabled()} />
        <div className="mt-6 flex justify-center">
          <AdminLanguageSwitcher />
        </div>
      </div>
    </AdminI18nProvider>
  );
}
