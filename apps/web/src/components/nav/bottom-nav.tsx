"use client";

import { BookOpen, Plus, Sparkles, User, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof BookOpen;
  match: (pathname: string) => boolean;
};

// Final shape (UX-2, 2026-05-20): [Lounge] [Members] [⊕ Capture] [Pairings] [You]
// Meetups moved off the primary nav into the You section per roadmap.
const SIDE_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Lounge",
    icon: BookOpen,
    match: (p) => p === "/",
  },
  {
    href: "/members",
    label: "Members",
    icon: Users,
    match: (p) => p.startsWith("/members"),
  },
  {
    href: "/pairings",
    label: "Pairings",
    icon: Sparkles,
    match: (p) => p.startsWith("/pairings"),
  },
  {
    href: "/settings",
    label: "You",
    icon: User,
    match: (p) => p.startsWith("/settings") || p.startsWith("/admin") || p.startsWith("/events"),
  },
];

/**
 * Fixed-bottom nav with a center brass FAB (UX-2).
 *
 * Five slots arranged in a grid; the middle slot holds an elevated Capture
 * button that visually breaks out of the bar plane. Brass-fill is allowed
 * here per the design system because Capture IS the primary action of the
 * authenticated shell.
 *
 * The four side tabs use outline icons over short ALL-CAPS labels with a
 * brass underline for the active state — brass-as-fill stays reserved for
 * primary actions per the design system.
 */
export function BottomNav() {
  const pathname = usePathname();
  const captureActive = pathname.startsWith("/capture");

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 bg-surface/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto max-w-md grid grid-cols-5 px-2 pt-1.5 pb-1 relative">
        <SideTab item={SIDE_ITEMS[0]} pathname={pathname} />
        <SideTab item={SIDE_ITEMS[1]} pathname={pathname} />

        {/* Center Capture FAB — lifted above the bar plane via -translate-y */}
        <li className="flex items-start justify-center">
          <Link
            href="/capture"
            aria-label="Capture"
            aria-current={captureActive ? "page" : undefined}
            className="group relative -translate-y-3"
          >
            <span
              className={cn(
                "block w-14 h-14 rounded-full flex items-center justify-center",
                "bg-accent text-ink-900 ring-4 ring-background",
                "shadow-[0_2px_10px_rgba(0,0,0,0.25)]",
                "transition-transform group-active:scale-95",
              )}
            >
              <Plus className="w-7 h-7" strokeWidth={2.25} aria-hidden="true" />
            </span>
            <span className="sr-only">Capture</span>
          </Link>
        </li>

        <SideTab item={SIDE_ITEMS[2]} pathname={pathname} />
        <SideTab item={SIDE_ITEMS[3]} pathname={pathname} />
      </ul>
    </nav>
  );
}

function SideTab({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = item.match(pathname);
  const Icon = item.icon;

  return (
    <li className="min-w-0">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-col items-center justify-center gap-1 py-1.5 transition-colors",
          active ? "text-foreground" : "text-foreground-subtle hover:text-foreground-muted",
        )}
      >
        <Icon className="w-5 h-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
        <span className="text-[10px] uppercase tracking-[0.12em] truncate max-w-full">
          {item.label}
        </span>
        <span
          className={cn(
            "h-0.5 w-6 rounded-full transition-colors -mt-0.5",
            active ? "bg-accent" : "bg-transparent",
          )}
        />
      </Link>
    </li>
  );
}
