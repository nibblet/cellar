"use client";

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
 */
export function FeedTabs({ active }: { active: FeedTab }) {
  return (
    <div role="tablist" aria-label="Feed view" className="flex justify-center gap-6 mb-5">
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
  );
}
