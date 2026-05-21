"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type FeedTab = "for-you" | "cigars" | "bourbons";

export const FEED_TABS: { value: FeedTab; label: string }[] = [
  { value: "for-you", label: "For You" },
  { value: "cigars", label: "Cigars" },
  { value: "bourbons", label: "Bourbons" },
];

/**
 * URL-driven segmented selector for the feed surface. Each tab is a real
 * link so navigation preserves scroll position and Next.js can stream the
 * matching slice. The active tab gets a brass underline — same vocabulary
 * as the bottom nav, so the two feel like one continuous surface.
 *
 * A small magnifier sits at the right edge as the entry into the catalog
 * search page. Absolute-positioned so the tabs stay perfectly centered.
 */
export function FeedTabs({ active }: { active: FeedTab }) {
  return (
    <div className="relative mb-5">
      <div role="tablist" aria-label="Feed view" className="flex justify-center gap-6">
        {FEED_TABS.map((t) => {
          const isActive = t.value === active;
          return (
            <Link
              key={t.value}
              href={t.value === "for-you" ? "/" : `/?tab=${t.value}`}
              role="tab"
              aria-selected={isActive}
              className={cn(
                "text-xs tracking-widest uppercase pb-1 transition-colors",
                isActive
                  ? "text-foreground border-b-2 border-accent"
                  : "text-foreground-subtle border-b-2 border-transparent hover:text-foreground-muted",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <Link
        href="/search"
        aria-label="Search the catalog"
        className="absolute right-0 top-1/2 -translate-y-1/2 -mt-0.5 p-1 text-foreground-subtle hover:text-foreground transition-colors"
      >
        <Search className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
      </Link>
    </div>
  );
}
