import { cn } from "@/lib/utils";

export type WinstonVariant = "splash" | "bust" | "glass" | "pour" | "library";

type WinstonProps = {
  variant: WinstonVariant;
  /** Pixel size of the rendered image. Square for circular variants, used as
   *  width for rectangular ones. */
  size?: number;
  className?: string;
  /** When Winston is presented alongside named context ("Winston suggests…"),
   *  he's decorative — the surrounding copy already names him. Stand-alone
   *  appearances should pass decorative={false} for screen readers. */
  decorative?: boolean;
};

/**
 * The single source of truth for Winston illustrations. Each variant maps to
 * one PNG in /public/winston/ — surface assignments are locked in
 * planning/nccc-roadmap.md Tier 3 #10.
 *
 * Variants:
 *  - splash    full-figure, seated. /login, /accept-invite, recap header.
 *  - bust      head + shoulders. Empty states, "Winston suggests…" headers.
 *  - glass     hand-offered glencairn roundel. Inline ornament above
 *              "Pairs with" dividers, "Winston says" callouts.
 *  - pour      active-pour pose. Daily Pour hero accent.
 *  - library   wide library scene with pour action. /welcome onboarding only.
 */
const variantSources: Record<WinstonVariant, string> = {
  splash: "/winston/winston-splash.png",
  bust: "/winston/winston-bust.png",
  glass: "/winston/winston-glass.png",
  pour: "/winston/winston-pour.png",
  library: "/winston/winston-library.png",
};

const variantAlt: Record<WinstonVariant, string> = {
  splash: "Winston, the resident narrator of Norton Commons Cigar Club",
  bust: "Winston",
  glass: "Winston offering a dram",
  pour: "Winston pouring a dram",
  library: "Winston in the club library",
};

export function Winston({ variant, size = 120, className, decorative = true }: WinstonProps) {
  const alt = decorative ? "" : variantAlt[variant];

  return (
    // biome-ignore lint/performance/noImgElement: served from /public, no need for next/image
    <img
      src={variantSources[variant]}
      alt={alt}
      width={size}
      height={size}
      className={cn("select-none", className)}
      aria-hidden={decorative ? true : undefined}
      draggable={false}
    />
  );
}
