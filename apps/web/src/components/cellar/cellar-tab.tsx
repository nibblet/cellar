"use client";

import { useState } from "react";
import { PickPourButton } from "@/components/feed";
import { Voice } from "@/components/primitives";
import { cn } from "@/lib/utils";

type CellarFilter = "have" | "want" | "tried";

type CellarProduct = {
  product_id: string;
  name: string;
  brand: string | null;
  type: string;
  image_url: string | null;
};

type CellarTabProps = {
  have: CellarProduct[];
  want: CellarProduct[];
  tried: CellarProduct[];
  isOwnProfile: boolean;
  memberFirstName: string;
};

/**
 * Tabbed cellar view on a member's profile page.
 * Three filter chips: Have / Want / Tried (default: Have).
 */
export function CellarTab({ have, want, tried, isOwnProfile, memberFirstName }: CellarTabProps) {
  const [filter, setFilter] = useState<CellarFilter>("have");

  const lists: Record<CellarFilter, CellarProduct[]> = { have, want, tried };
  const current = lists[filter];

  const emptyMessages: Record<CellarFilter, string> = {
    have: isOwnProfile
      ? '"The shelf is bare. Add what you\'re pouring tonight."'
      : `"${memberFirstName} hasn't stocked the shelf yet."`,
    want: isOwnProfile
      ? '"Nothing on the wishlist yet, sir. Tap Want on any product to start one."'
      : `"${memberFirstName}'s wishlist is empty."`,
    tried: isOwnProfile
      ? '"No history yet. Recommend something to NCCC and it will appear here."'
      : `"${memberFirstName} hasn't marked anything as tried yet."`,
  };

  const hasHaveItems = have.length >= 1;

  return (
    <div>
      {isOwnProfile && hasHaveItems ? (
        <div className="mb-4">
          <PickPourButton variant="primary" label="Pick for me →" />
        </div>
      ) : null}

      {isOwnProfile && !hasHaveItems ? (
        <Voice className="block mb-4 text-sm">
          "Stock the shelf first, sir — then I'll pick from what you have."
        </Voice>
      ) : null}

      {/* Filter chips */}
      <div className="flex items-center gap-2 mb-4">
        {(["have", "want", "tried"] as CellarFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "inline-flex items-center px-3 py-1 rounded-full text-[12px] tracking-wide capitalize transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              filter === f
                ? "bg-accent-tint text-foreground border border-accent"
                : "bg-surface text-foreground-muted border border-border hover:bg-surface-2",
            )}
          >
            {f}{" "}
            {lists[f].length > 0 ? (
              <span className="ml-1 text-foreground-subtle">{lists[f].length}</span>
            ) : null}
          </button>
        ))}
      </div>

      {current.length === 0 ? (
        <p className="text-sm text-foreground-subtle italic text-center py-4">
          {emptyMessages[filter]}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {current.map((p) => (
            <a
              key={p.product_id}
              href={`/products/${p.product_id}`}
              className="flex items-center gap-3 rounded-[12px] border border-border bg-surface px-3.5 py-2.5 hover:bg-surface-2 transition-colors"
            >
              {p.image_url ? (
                // biome-ignore lint/performance/noImgElement: public catalog URL, no signing needed
                <img
                  src={p.image_url}
                  alt={p.name}
                  className="w-9 h-9 rounded-lg object-contain bg-surface-2 shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-surface-2 shrink-0 flex items-center justify-center text-[10px] text-foreground-subtle uppercase tracking-widest">
                  {p.type === "cigar" ? "🚬" : "🥃"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-foreground truncate">{p.name}</p>
                <p className="text-[11px] text-foreground-muted truncate">
                  {p.brand ?? ""}
                  {p.brand ? " · " : ""}
                  <span className="uppercase tracking-widest text-foreground-subtle">{p.type}</span>
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
