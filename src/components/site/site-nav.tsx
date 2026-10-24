"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type NavLink = {
  href: string;
  label: string;
  /** The link is current on this path, and with this `operation` filter when given. */
  match: { path: string; operation?: string };
};

/** Header links, with `aria-current` on the section you are in. */
export function NavLinks({
  links,
  stacked = false,
  static: isStatic = false,
}: {
  links: NavLink[];
  stacked?: boolean;
  /** Prerendered fallback: no current link, since the URL is not known yet. */
  static?: boolean;
}) {
  return (
    <ul className={stacked ? "flex flex-col" : "flex items-center gap-8 text-[0.95rem]"}>
      {links.map((link) => (
        <li key={link.href}>
          {isStatic ? (
            <Item link={link} stacked={stacked} current={false} />
          ) : (
            <CurrentItem link={link} stacked={stacked} />
          )}
        </li>
      ))}
    </ul>
  );
}

function CurrentItem({ link, stacked }: { link: NavLink; stacked: boolean }) {
  const pathname = usePathname();
  const operation = useSearchParams().get("operation");
  const current =
    pathname === link.match.path &&
    (link.match.operation === undefined || link.match.operation === operation);
  return <Item link={link} stacked={stacked} current={current} />;
}

function Item({ link, stacked, current }: { link: NavLink; stacked: boolean; current: boolean }) {
  return (
    <Link
      href={link.href}
      aria-current={current ? "page" : undefined}
      className={cn(
        stacked
          ? "hover:bg-canvas block rounded px-3 py-2.5 aria-[current=page]:font-medium"
          : "block py-1 underline-offset-8 opacity-85 transition-opacity hover:opacity-100 aria-[current=page]:underline aria-[current=page]:opacity-100",
      )}
    >
      {link.label}
    </Link>
  );
}

/**
 * The small-screen menu: a native disclosure, so it opens before JavaScript loads.
 * Once hydrated it closes itself when a link is followed, since the layout (and the open
 * disclosure) stays mounted across navigations.
 */
export function MobileMenu({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={ref} className="relative lg:hidden">
      <summary className="flex h-9 cursor-pointer list-none items-center rounded-full border border-current/40 px-4 text-sm [&::-webkit-details-marker]:hidden">
        {label}
      </summary>
      <div
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a") && ref.current) ref.current.open = false;
        }}
        className="border-line bg-surface text-ink absolute right-0 mt-2 w-56 rounded-md border p-2 shadow-lg"
      >
        {children}
      </div>
    </details>
  );
}
