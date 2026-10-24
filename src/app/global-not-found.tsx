/* eslint-disable @next/next/no-html-link-for-pages -- this page renders outside the app router, so plain links are intended. */
import "@fontsource-variable/alegreya";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import "./globals.css";

// For URLs that match no route at all. The site has two root layouts ([locale] and the back office),
// so there's no single layout to render a 404 inside; this page brings its own <html>.

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="bg-surface font-sans">
        <main className="mx-auto max-w-2xl px-6 py-24">
          <h1 className="font-display text-5xl">This page doesn&apos;t exist</h1>
          <p className="text-muted mt-4 text-lg">
            Check the address, or start from the homes list.
          </p>
          <p className="mt-8 flex gap-3 text-sm">
            <a
              className="bg-accent rounded-md px-4 py-2 font-medium text-white"
              href="/es"
              lang="es"
            >
              Viviendas
            </a>
            <a className="border-line rounded-md border px-4 py-2" href="/en" lang="en">
              Homes
            </a>
            <a className="border-line rounded-md border px-4 py-2" href="/uk" lang="uk">
              Житло
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
