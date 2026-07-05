"use client";

import { BookOpen, Boxes, Plus, Sparkles, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_HOME_PATH, CELLAR_PATH } from "@/lib/navigation/paths";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof BookOpen;
  match: (pathname: string) => boolean;
};

const SIDE_ITEMS: NavItem[] = [
  {
    href: CELLAR_PATH,
    label: "Cellar",
    icon: BookOpen,
    match: (p) => p === CELLAR_PATH,
  },
  {
    href: "/catalog",
    label: "Catalog",
    icon: Boxes,
    match: (p) => p.startsWith("/catalog"),
  },
  {
    href: "/pairings",
    label: "Pairings",
    icon: Sparkles,
    match: (p) => p.startsWith("/pairings"),
  },
  {
    href: APP_HOME_PATH,
    label: "You",
    icon: User,
    match: (p) => p.startsWith("/you"),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const captureActive = pathname.startsWith("/capture");

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 bg-surface/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto max-w-md grid grid-cols-5 px-6 pt-1.5 pb-1 relative">
        <SideTab item={SIDE_ITEMS[0]} pathname={pathname} />
        <SideTab item={SIDE_ITEMS[1]} pathname={pathname} />

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
          "flex flex-col items-center justify-center gap-1 py-2 min-h-11 transition-colors",
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
