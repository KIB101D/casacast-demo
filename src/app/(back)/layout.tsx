import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/lib/constants";
import "../globals.css";

// Root layout of the back office (admin + login). The public site has its own under [locale],
// so each part sets its own <html lang>.

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s · ${PRODUCT_NAME}` },
  robots: { index: false, follow: false },
};

export default function BackOfficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
