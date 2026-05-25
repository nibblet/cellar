"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Card,
  cardFocusClassName,
  Divider,
  interactiveCardClassName,
} from "@/components/primitives";
import type {
  FindNextMode,
  FindNextPairSuggestion,
  FindNextProductSuggestion,
  FindNextSuggestions,
} from "@/lib/find-next/types";
import { cn } from "@/lib/utils";

const MODE_LABELS: Record<FindNextMode, { title: string; subtitle: string }> = {
  pairing: { title: "Today's pairing", subtitle: "Cigar + bourbon" },
  pour: { title: "Today's pour", subtitle: "From your shelf or catalog" },
  smoke: { title: "Today's smoke", subtitle: "From your shelf or catalog" },
};

const INTERACTIVE_TILE = cn(interactiveCardClassName, cardFocusClassName);

function productHeadline(name: string, brand: string | null): string {
  if (!brand) return name;
  if (name.toLowerCase().startsWith(brand.toLowerCase())) return name;
  return `${brand} ${name}`;
}

type FindYourNextHeroProps = {
  suggestions: FindNextSuggestions;
};

export function FindYourNextHero({ suggestions }: FindYourNextHeroProps) {
  const [active, setActive] = useState<FindNextMode | null>(null);
  const topPair = suggestions.pairing[0] ?? null;

  return (
    <div className="mb-4">
      <Divider label="Find your next" />

      <div className="mt-3 flex flex-col gap-2">
        <PairingHeroTile
          topPair={topPair}
          count={suggestions.pairing.length}
          onOpenSheet={() => setActive("pairing")}
        />
        <div className="grid grid-cols-2 gap-2">
          <CompactTile
            mode="pour"
            count={suggestions.pour.length}
            onOpen={() => setActive("pour")}
          />
          <CompactTile
            mode="smoke"
            count={suggestions.smoke.length}
            onOpen={() => setActive("smoke")}
          />
        </div>
      </div>

      {active ? (
        <FindNextSheet mode={active} suggestions={suggestions} onClose={() => setActive(null)} />
      ) : null}
    </div>
  );
}

function PairingHeroTile({
  topPair,
  count,
  onOpenSheet,
}: {
  topPair: FindNextPairSuggestion | null;
  count: number;
  onOpenSheet: () => void;
}) {
  const { title } = MODE_LABELS.pairing;

  if (!topPair) {
    return (
      <button
        type="button"
        onClick={onOpenSheet}
        className={cn(INTERACTIVE_TILE, "w-full text-left px-4 py-4")}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-base text-foreground">{title}</p>
          <p className="text-[10px] uppercase tracking-widest text-foreground-subtle shrink-0">
            Browse
          </p>
        </div>
        <p className="text-xs text-foreground-muted mt-0.5">Cigar + bourbon</p>
      </button>
    );
  }

  return (
    <div className={cn(INTERACTIVE_TILE, "px-4 py-4")}>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="text-[10px] uppercase tracking-widest text-foreground-subtle">{title}</p>
        <button
          type="button"
          onClick={onOpenSheet}
          className="text-[10px] uppercase tracking-widest text-foreground-subtle hover:text-foreground transition-colors shrink-0"
        >
          {count} picks →
        </button>
      </div>
      <Link href={`/pairings/${topPair.cigar_id}/${topPair.bourbon_id}`} className="block group">
        <p className="text-base text-foreground truncate group-hover:text-accent transition-colors">
          {productHeadline(topPair.cigar_name, topPair.cigar_brand)}
        </p>
        <p className="text-[11px] tracking-widest uppercase text-foreground-subtle my-1">with</p>
        <p className="text-base text-foreground truncate group-hover:text-accent transition-colors">
          {productHeadline(topPair.bourbon_name, topPair.bourbon_brand)}
        </p>
        {topPair.club_validated ? (
          <p className="text-[10px] uppercase tracking-widest text-moss-600 mt-2">● club tried</p>
        ) : null}
      </Link>
    </div>
  );
}

function CompactTile({
  mode,
  count,
  onOpen,
}: {
  mode: Exclude<FindNextMode, "pairing">;
  count: number;
  onOpen: () => void;
}) {
  const { title } = MODE_LABELS[mode];
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(INTERACTIVE_TILE, "w-full text-left px-3.5 py-3")}
    >
      <p className="text-sm text-foreground truncate">{title}</p>
      <p className="text-[10px] uppercase tracking-widest text-foreground-subtle mt-1">
        {count > 0 ? `${count} picks` : "Browse"}
      </p>
    </button>
  );
}

function FindNextSheet({
  mode,
  suggestions,
  onClose,
}: {
  mode: FindNextMode;
  suggestions: FindNextSuggestions;
  onClose: () => void;
}) {
  const { title } = MODE_LABELS[mode];

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col justify-end bg-ink-900/40"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative mx-auto w-full max-w-md max-h-[70dvh] overflow-y-auto overscroll-contain rounded-t-[16px] border border-border bg-background px-6 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-xl">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-foreground-muted hover:text-foreground"
          >
            Done
          </button>
        </div>

        {mode === "pairing" ? (
          <PairingList items={suggestions.pairing} />
        ) : mode === "pour" ? (
          <ProductList items={suggestions.pour} />
        ) : (
          <ProductList items={suggestions.smoke} />
        )}
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: "cellar" | "catalog" }) {
  return (
    <span className="text-[10px] uppercase tracking-widest text-foreground-subtle">
      {source === "cellar" ? "On your shelf" : "From the catalog"}
    </span>
  );
}

function PairingList({ items }: { items: FindNextPairSuggestion[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-foreground-subtle italic">
        Stock your Have shelf with a cigar and a bourbon, or browse the catalog tabs below.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <Link
          key={`${item.cigar_id}:${item.bourbon_id}`}
          href={`/pairings/${item.cigar_id}/${item.bourbon_id}`}
          className="block"
        >
          <Card className="hover:bg-surface-2 transition-colors">
            <SourceBadge source={item.source} />
            <p className="text-base text-foreground mt-1 truncate">
              {productHeadline(item.cigar_name, item.cigar_brand)}
            </p>
            <p className="text-[11px] tracking-widest uppercase text-foreground-subtle my-1">
              paired with
            </p>
            <p className="text-base text-foreground truncate">
              {productHeadline(item.bourbon_name, item.bourbon_brand)}
            </p>
            {item.club_validated ? (
              <p className="text-[10px] uppercase tracking-widest text-moss-600 mt-2">
                ● club tried
              </p>
            ) : null}
          </Card>
        </Link>
      ))}
    </div>
  );
}

function ProductList({ items }: { items: FindNextProductSuggestion[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-foreground-subtle italic">
        Mark a few on your Have shelf, or set taste preferences in You → Settings.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <Link key={item.product_id} href={`/products/${item.product_id}`} className="block">
          <Card className="hover:bg-surface-2 transition-colors">
            <SourceBadge source={item.source} />
            <p className="text-base text-foreground mt-1 truncate">
              {productHeadline(item.name, item.brand)}
            </p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
