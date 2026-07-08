"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { LogFilter } from "@/lib/log/parse-filter";
import { LOG_PATH } from "@/lib/navigation/paths";
import { cn } from "@/lib/utils";

const TABS: { filter: LogFilter; label: string }[] = [
  { filter: "all", label: "All" },
  { filter: "tastings", label: "Tastings" },
  { filter: "pairings", label: "Pairings" },
];

export function LogFilterTabs({ active }: { active: LogFilter }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function hrefFor(filter: LogFilter): string {
    if (filter === "all") return LOG_PATH;
    const params = new URLSearchParams(searchParams.toString());
    params.set("filter", filter);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="mb-5 flex gap-4 border-b border-border">
      {TABS.map((tab) => (
        <Link
          key={tab.filter}
          href={hrefFor(tab.filter)}
          className={cn(
            "pb-2 text-xs tracking-widest uppercase transition-colors",
            active === tab.filter
              ? "text-foreground border-b-2 border-accent"
              : "text-foreground-subtle border-b-2 border-transparent hover:text-foreground-muted",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
