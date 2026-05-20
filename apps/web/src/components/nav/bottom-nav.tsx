"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

const ITEMS: NavItem[] = [
  { href: "/", label: "Feed", match: (p) => p === "/" },
  { href: "/capture", label: "Capture", match: (p) => p.startsWith("/capture") },
  { href: "/members", label: "Members", match: (p) => p.startsWith("/members") },
  { href: "/events", label: "Meetups", match: (p) => p.startsWith("/events") },
];

/**
 * Fixed-bottom nav for the authenticated shell. Five tabs is the upper
 * limit before thumbs start missing; four leaves comfortable room.
 *
 * Active state uses brass underline rather than a fill, to keep brass
 * reserved for primary actions per the design system.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 bg-surface/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto max-w-md grid grid-cols-4">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center py-3 text-xs uppercase tracking-widest transition-colors",
                  active ? "text-foreground" : "text-foreground-subtle hover:text-foreground-muted",
                )}
              >
                <span>{item.label}</span>
                <span
                  className={cn(
                    "mt-1 h-0.5 w-6 rounded-full transition-colors",
                    active ? "bg-accent" : "bg-transparent",
                  )}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
