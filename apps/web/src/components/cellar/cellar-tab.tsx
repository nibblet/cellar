"use client";

import { startTransition, useOptimistic, useState } from "react";
import { PickPourButton } from "@/components/feed";
import { Voice } from "@/components/primitives";
import { setCellarState } from "@/lib/cellar/actions";
import { cn } from "@/lib/utils";

type CellarFilter = "have" | "want" | "tried";
type TypeFilter = "all" | "cigar" | "bourbon";

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
  lovedProductIds: string[];
  isOwnProfile: boolean;
  memberFirstName: string;
};

export function CellarTab({
  have,
  want,
  tried,
  lovedProductIds,
  isOwnProfile,
  memberFirstName,
}: CellarTabProps) {
  const [filter, setFilter] = useState<CellarFilter>("have");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [lovedIds, setLovedIds] = useState<Set<string>>(() => new Set(lovedProductIds));
  const [removedIds, setRemovedIds] = useOptimistic<
    Record<string, Set<string>>,
    { filter: CellarFilter; productId: string }
  >({} as Record<string, Set<string>>, (prev, { filter: f, productId }) => {
    const key = f;
    const next = new Set(prev[key]);
    next.add(productId);
    return { ...prev, [key]: next };
  });

  const lists: Record<CellarFilter, CellarProduct[]> = { have, want, tried };

  const visibleList = lists[filter]
    .filter((p) => !removedIds[filter]?.has(p.product_id))
    .filter((p) => typeFilter === "all" || p.type === typeFilter);

  const typeFilteredList = lists[filter].filter((p) => !removedIds[filter]?.has(p.product_id));
  const cigarCount = typeFilteredList.filter((p) => p.type === "cigar").length;
  const bourbonCount = typeFilteredList.filter((p) => p.type === "bourbon").length;
  const hasBothTypes = cigarCount > 0 && bourbonCount > 0;

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

  function handleRemove(productId: string) {
    startTransition(() => {
      setRemovedIds({ filter, productId });
      setCellarState(productId, { [filter]: false });
    });
  }

  // Love is a private signal and implies tried, so it only appears on the
  // member's own Have / Tried lists (both are already tried).
  const canLove = isOwnProfile && (filter === "have" || filter === "tried");

  function handleToggleLove(productId: string) {
    const next = !lovedIds.has(productId);
    setLovedIds((prev) => {
      const updated = new Set(prev);
      if (next) updated.add(productId);
      else updated.delete(productId);
      return updated;
    });
    startTransition(() => {
      setCellarState(productId, { loved: next });
    });
  }

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

      {/* State filter chips: Have / Want / Tried */}
      <div className="flex items-center gap-2 mb-3">
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

      {/* Type filter: All / Cigars / Bourbons — only shown when both types exist */}
      {hasBothTypes ? (
        <div className="flex items-center gap-1.5 mb-4">
          {[
            { key: "all" as TypeFilter, label: "All" },
            { key: "cigar" as TypeFilter, label: `Cigars ${cigarCount}` },
            { key: "bourbon" as TypeFilter, label: `Bourbons ${bourbonCount}` },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTypeFilter(key)}
              className={cn(
                "px-2.5 py-0.5 rounded-full text-[11px] tracking-wide transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                typeFilter === key
                  ? "bg-surface-2 text-foreground border border-border"
                  : "text-foreground-subtle hover:text-foreground-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {visibleList.length === 0 ? (
        <p className="text-sm text-foreground-subtle italic text-center py-4">
          {typeFilter !== "all"
            ? `No ${typeFilter === "cigar" ? "cigars" : "bourbons"} in this list.`
            : emptyMessages[filter]}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleList.map((p) => (
            <div
              key={p.product_id}
              className="flex items-center gap-3 rounded-[12px] border border-border bg-surface px-3.5 py-2.5 hover:bg-surface-2 transition-colors"
            >
              <a
                href={`/products/${p.product_id}`}
                className="flex items-center gap-3 flex-1 min-w-0"
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
                    <span className="uppercase tracking-widest text-foreground-subtle">
                      {p.type}
                    </span>
                  </p>
                </div>
              </a>
              {canLove ? (
                <button
                  type="button"
                  onClick={() => handleToggleLove(p.product_id)}
                  className={cn(
                    "shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-surface-2",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
                    lovedIds.has(p.product_id)
                      ? "text-ember-500"
                      : "text-foreground-subtle hover:text-foreground",
                  )}
                  aria-label={lovedIds.has(p.product_id) ? "Remove love" : "Love"}
                  aria-pressed={lovedIds.has(p.product_id)}
                  title="Love"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M8 13.5S2.5 10 2.5 6.2A2.7 2.7 0 018 4.6a2.7 2.7 0 015.5 1.6C13.5 10 8 13.5 8 13.5z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill={lovedIds.has(p.product_id) ? "currentColor" : "none"}
                      fillOpacity={lovedIds.has(p.product_id) ? 0.25 : 0}
                    />
                  </svg>
                </button>
              ) : null}
              {isOwnProfile ? (
                <button
                  type="button"
                  onClick={() => handleRemove(p.product_id)}
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-foreground-subtle hover:text-foreground hover:bg-surface-2 transition-colors"
                  aria-label={`Remove from ${filter}`}
                  title={`Remove from ${filter}`}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path
                      d="M4 4l6 6M10 4l-6 6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
