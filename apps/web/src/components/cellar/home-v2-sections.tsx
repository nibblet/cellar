"use client";

import Link from "next/link";
import { Winston } from "@/components/brand/winston";
import { Button, Card, Voice } from "@/components/primitives";
import type { HomeHuntNextPick, HomeTryNextPick } from "@/lib/cellar/home-v2";
import { cn } from "@/lib/utils";

type CellarStatStripProps = {
  bottleCount: number;
  cigarCount: number;
  huntingCount: number;
};

type PalateTickerProps = {
  traits: string[];
};

type TonightsPickCardProps = {
  line: string;
  href: string;
  cigarName: string;
  bourbonName: string;
  cigarImageUrl: string | null;
  bourbonImageUrl: string | null;
  quote: string | null;
  noteNumber: string;
  rollIndex?: number;
  onShuffle?: () => void;
};

type TryNextSectionProps = {
  bourbons: HomeTryNextPick[];
  cigars: HomeTryNextPick[];
};

type HuntNextRailProps = {
  items: HomeHuntNextPick[];
  onWant: (productId: string) => void;
  pendingProductId?: string | null;
};

type CellarEmptyStateProps = {
  href: string;
};

export function CellarStatStrip({ bottleCount, cigarCount, huntingCount }: CellarStatStripProps) {
  return (
    <div className="mb-5 border-b border-border pb-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <StatPill label="Bottles" value={bottleCount} />
        <StatPill label="Cigars" value={cigarCount} />
        <StatPill label="Hunting" value={huntingCount} accent />
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <p className="text-[12px] uppercase tracking-[0.2em] text-foreground-subtle">
      <span className={cn("mr-1.5 font-semibold", accent ? "text-[#d86f49]" : "text-accent")}>
        {value}
      </span>
      {label}
    </p>
  );
}

export function PalateTicker({ traits }: PalateTickerProps) {
  if (traits.length === 0) return null;

  const tokens = [...traits, ...traits];

  return (
    <section className="-mx-6 mb-6 overflow-hidden border-y border-border bg-[#1b1510]">
      <div className="flex items-center gap-4 px-6 py-3">
        <div className="shrink-0 whitespace-nowrap text-[11px] uppercase tracking-[0.18em] text-accent">
          Palate{" "}
          <span className="font-display text-xl lowercase italic tracking-normal text-[#a88a63]">
            bar
          </span>
        </div>
        <div className="home-palate-ticker-mask min-w-0 flex-1">
          <div className="home-palate-ticker-track">
            {tokens.map((trait, index) => (
              <span
                key={`${trait}-${index}`}
                className="whitespace-nowrap font-display text-[2rem] leading-none tracking-[-0.02em] text-[#f2e5cb]"
              >
                {trait}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function TonightsPickCard({
  line,
  href,
  cigarName,
  bourbonName,
  cigarImageUrl,
  bourbonImageUrl,
  quote,
  noteNumber,
  rollIndex = 0,
  onShuffle,
}: TonightsPickCardProps) {
  return (
    <section className="-mx-6 mb-8 overflow-hidden border-y border-border bg-[radial-gradient(circle_at_top,#7d2f17_0%,#43170f_33%,#160f0b_68%,#0e0b09_100%)]">
      <div className="px-6 py-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#f0cf95]">
            Tonight&apos;s pick
          </p>
          <div className="flex items-center gap-3">
            {onShuffle ? (
              <button
                type="button"
                onClick={onShuffle}
                className="text-[10px] uppercase tracking-[0.18em] text-[#d3a86b] hover:text-[#f0cf95]"
              >
                Shuffle
              </button>
            ) : null}
            <p className="font-display text-lg tracking-[0.14em] text-[#d3a86b]">
              No {String(rollIndex + 1).padStart(2, "0")}
            </p>
          </div>
        </div>

        <div className="relative mt-6 h-44 overflow-hidden">
          <CircleBadge
            tone="cigar"
            label="Cigar"
            sublabel="at browse 1"
            imageUrl={cigarImageUrl}
            imageAlt={cigarName}
            className="left-1 top-2"
          />
          <CircleBadge
            tone="bourbon"
            label="Bourbon"
            sublabel="at browse 2"
            imageUrl={bourbonImageUrl}
            imageAlt={bourbonName}
            className="right-1 top-2"
          />
          <div className="absolute left-1/2 top-[5.2rem] z-20 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border border-[rgba(255,236,192,0.45)] bg-[rgba(32,20,13,0.55)] text-[2.3rem] leading-none text-[#f3ead6]">
            ×
          </div>
        </div>

        <h2 className="mt-1 text-[2.25rem] leading-[1.02] text-[#f6ead4]">
          {cigarName} <span className="text-accent">×</span> {bourbonName}
        </h2>
        <Voice className="mt-3 block max-w-[28rem] text-[1.15rem] leading-relaxed text-[#e5d0bb] italic">
          &quot;{quote ?? line}&quot;
        </Voice>
        {quote && quote !== line ? <p className="mt-2 text-sm text-[#cdb399]">{line}</p> : null}

        <Link
          href={href}
          className={cn(
            "mt-6 flex h-[72px] w-full items-center justify-between border border-[#d7a555] px-7 py-4 transition-colors",
            "text-[#f0cf95] hover:bg-[rgba(255,214,125,0.06)]",
          )}
        >
          <span className="text-[14px] uppercase tracking-[0.24em] font-medium">
            See the pairing
          </span>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f1cb68] text-ink-900 text-2xl">
            →
          </span>
        </Link>
      </div>
    </section>
  );
}

function CircleBadge({
  tone,
  label,
  sublabel,
  imageUrl,
  imageAlt,
  className,
}: {
  tone: "cigar" | "bourbon";
  label: string;
  sublabel: string;
  imageUrl: string | null;
  imageAlt: string;
  className?: string;
}) {
  const toneClass =
    tone === "cigar"
      ? "bg-[radial-gradient(circle_at_top,#b5522a_0%,#8a3217_45%,#5f1f12_100%)]"
      : "bg-[radial-gradient(circle_at_top,#d6b46b_0%,#ba9450_48%,#866331_100%)]";

  return (
    <div
      className={cn(
        "absolute z-10 h-36 w-36 overflow-hidden rounded-full border border-[rgba(241,204,122,0.8)] shadow-[inset_0_0_0_1px_rgba(255,226,173,0.2)]",
        toneClass,
        className,
      )}
    >
      {imageUrl ? (
        <>
          {/* biome-ignore lint/performance/noImgElement: product images are public catalog URLs */}
          <img
            src={imageUrl}
            alt={imageAlt}
            className="absolute inset-0 h-full w-full object-cover nccc-photo nccc-photo--sepia scale-[1.03]"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,226,173,0.16)_0%,rgba(32,20,13,0.02)_40%,rgba(14,10,8,0.36)_100%)]" />
        </>
      ) : null}
      <div className="absolute inset-x-6 top-[46%] border-t border-dashed border-[rgba(38,21,12,0.28)]" />
      <div
        className={cn(
          "relative flex h-full flex-col items-center justify-center text-center text-[#28160f]",
          imageUrl && "justify-end pb-8 text-[#f6ead4]",
        )}
      >
        {!imageUrl ? (
          <>
            <p className="text-[0.95rem] font-medium">{label}</p>
            <p className="mt-1 text-[0.72rem] opacity-70">{sublabel}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function TryNextSection({ bourbons, cigars }: TryNextSectionProps) {
  if (bourbons.length === 0 && cigars.length === 0) return null;

  const visibleBourbons = bourbons.slice(0, 2);
  const visibleCigars = cigars.slice(0, 2);

  return (
    <section className="mb-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="text-[2rem] leading-none">Try next</h2>
        <p className="text-[11px] uppercase tracking-[0.22em] text-foreground-subtle">
          From your shelf
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {visibleBourbons.map((pick) => (
          <ProductCard key={pick.product_id} pick={pick} eyebrow="Bourbon" />
        ))}
        {visibleCigars.map((pick) => (
          <ProductCard key={pick.product_id} pick={pick} eyebrow="Cigar" />
        ))}
      </div>
    </section>
  );
}

export function HuntNextRail({ items, onWant, pendingProductId }: HuntNextRailProps) {
  if (items.length === 0) return null;

  const forYou = items.filter((item) => item.lane !== "fresh");
  const fresh = items.filter((item) => item.lane === "fresh");

  return (
    <section className="mb-5">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-accent">✦</span>
            <h2 className="text-[2rem] leading-none">Hunt next</h2>
          </div>
          <Voice className="block text-sm mt-1">
            &quot;Not yet on your shelf, but squarely your palate.&quot;
          </Voice>
        </div>
        <p className="shrink-0 text-[11px] uppercase tracking-[0.22em] text-foreground-subtle">
          Worth the chase
        </p>
      </div>

      {fresh.length > 0 ? (
        <HuntNextLane
          label="Fresh drops"
          items={fresh}
          onWant={onWant}
          pendingProductId={pendingProductId}
        />
      ) : null}

      <HuntNextLane
        label={fresh.length > 0 ? "For your palate" : undefined}
        items={forYou}
        onWant={onWant}
        pendingProductId={pendingProductId}
      />
    </section>
  );
}

function HuntNextLane({
  label,
  items,
  onWant,
  pendingProductId,
}: {
  label?: string;
  items: HomeHuntNextPick[];
  onWant: (productId: string) => void;
  pendingProductId?: string | null;
}) {
  if (items.length === 0) return null;

  return (
    <div className={label ? "mb-4" : undefined}>
      {label ? (
        <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-foreground-subtle">
          {label}
        </p>
      ) : null}
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <HuntNextCard
            key={item.product_id}
            item={item}
            onWant={onWant}
            pendingProductId={pendingProductId}
          />
        ))}
      </div>
    </div>
  );
}

function HuntNextCard({
  item,
  onWant,
  pendingProductId,
}: {
  item: HomeHuntNextPick;
  onWant: (productId: string) => void;
  pendingProductId?: string | null;
}) {
  return (
    <div className="min-w-[215px] max-w-[215px] shrink-0 snap-start">
      <Card className="relative min-h-[246px] overflow-hidden border-[rgba(184,137,88,0.12)] bg-[linear-gradient(180deg,#25170f_0%,#1b130e_100%)] px-4 py-4">
        {item.rarityLabel ? (
          <span className="absolute left-3 top-3 -rotate-[8deg] rounded-[8px] border border-[rgba(211,168,107,0.55)] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[#f0cf95]">
            {item.rarityLabel}
          </span>
        ) : null}
        <div className="mt-8 h-[108px] overflow-hidden rounded-[18px] border border-[rgba(184,137,88,0.18)] bg-[radial-gradient(circle_at_top,#6b2818_0%,#26160f_60%,#1a130e_100%)]">
          {item.image_url ? (
            // biome-ignore lint/performance/noImgElement: product images are public catalog URLs
            <img
              src={item.image_url}
              alt={item.name}
              className="h-full w-full object-cover nccc-photo nccc-photo--sepia"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[rgba(240,207,149,0.18)]">
              <span className="text-[12px] uppercase tracking-[0.18em]">
                {item.product_type === "bourbon" ? "Bottle" : "Cigar"}
              </span>
            </div>
          )}
        </div>
        <Link href={`/products/${item.product_id}`} className="mt-4 block">
          <p className="text-[1.45rem] leading-tight text-[#f5e9d5]">{item.name}</p>
          {item.brand ? (
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-foreground-subtle">
              {item.brand}
            </p>
          ) : null}
        </Link>
        {item.rationale ? (
          <Voice className="block text-sm text-[#d7c2ab] mt-2 italic line-clamp-2">
            &quot;{item.rationale}&quot;
          </Voice>
        ) : null}
        <div className="mt-4">
          <Button
            variant="secondary"
            className="h-10 rounded-full border-[rgba(184,137,88,0.28)] bg-transparent px-4 text-[12px] uppercase tracking-[0.18em] text-[#f0cf95] hover:bg-[rgba(255,214,125,0.06)]"
            onClick={() => onWant(item.product_id)}
            disabled={pendingProductId === item.product_id}
          >
            {pendingProductId === item.product_id ? "Saving..." : "+ Want"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function CellarEmptyState({ href }: CellarEmptyStateProps) {
  return (
    <Card className="mb-5 flex flex-col items-center text-center gap-4 py-6">
      <Winston variant="bust" size={84} className="rounded-full" />
      <Voice className="block max-w-[24rem]">
        Nothing to read yet. Snap a bottle or cigar, or set your preferences and I&apos;ll start the
        chase.
      </Voice>
      <Link
        href={href}
        className={cn(
          "block w-full max-w-xs inline-flex items-center justify-center gap-2 rounded-[12px] transition-colors",
          "h-14 px-6 text-base font-medium",
          "bg-accent text-ink-900 hover:bg-accent-hover active:bg-accent-hover",
        )}
      >
        Open capture
      </Link>
    </Card>
  );
}

function ProductCard({ pick, eyebrow }: { pick: HomeTryNextPick; eyebrow: string }) {
  return (
    <Link
      href={`/products/${pick.product_id}`}
      className={cn(
        "group relative min-h-[182px] rounded-[18px] border border-[rgba(184,137,88,0.12)] bg-[linear-gradient(180deg,#1f1510_0%,#17110d_100%)] px-4 py-4",
        "transition-colors hover:border-[rgba(212,168,98,0.3)] hover:bg-[linear-gradient(180deg,#241811_0%,#1a120e_100%)]",
      )}
    >
      <div className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-[rgba(212,106,69,0.95)]" />
      <div className="-mx-4 -mt-4 h-[112px] overflow-hidden border-b border-[rgba(184,137,88,0.12)]">
        {pick.image_url ? (
          // biome-ignore lint/performance/noImgElement: product images are public catalog URLs
          <img
            src={pick.image_url}
            alt={pick.name}
            className="h-full w-full object-cover nccc-photo nccc-photo--sepia"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#51301d_0%,#241912_100%)] text-[11px] uppercase tracking-[0.18em] text-foreground-subtle"
            aria-hidden="true"
          />
        )}
      </div>
      <div className="mt-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-foreground-subtle">{eyebrow}</p>
        <p className="text-[1.55rem] leading-tight text-[#f4e7d2]">{pick.name}</p>
        {pick.brand ? (
          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-foreground-subtle">
            {pick.brand}
          </p>
        ) : null}
        {pick.rationale ? (
          <Voice className="mt-2 block text-[15px] leading-snug text-[#d6c0aa] italic line-clamp-2">
            &quot;{pick.rationale}&quot;
          </Voice>
        ) : null}
      </div>
    </Link>
  );
}
