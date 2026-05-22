import { cn } from "@/lib/utils";

type NCCCLogoProps = {
  size?: number;
  className?: string;
  /** Roundel uses the full circular logo; bust crops to head + collar (handled by CSS for now). */
  variant?: "roundel" | "bust";
  /** Decorative when paired with adjacent text; semantic when stand-alone. */
  decorative?: boolean;
};

/**
 * Single source of truth for rendering the NCCC mark. Drop the source PNG
 * at apps/web/public/icons/nccc-logo.png and this component picks it up
 * everywhere.
 *
 * The variants are currently a single image with different CSS framings —
 * cheaper than commissioning separate art, and reads as "the same friend"
 * across screens.
 */
export function NCCCLogo({
  size = 80,
  className,
  variant = "roundel",
  decorative = false,
}: NCCCLogoProps) {
  const alt = decorative ? "" : "Norton Commons Cigar Club";

  if (variant === "bust") {
    // Crop the upper portion of the roundel to a circle; offsets the
    // logo upward so Winston's bust dominates the frame.
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-full bg-surface border border-border",
          className,
        )}
        style={{ width: size, height: size }}
        aria-hidden={decorative ? true : undefined}
      >
        {/* biome-ignore lint/performance/noImgElement: served from /public, no need for next/image */}
        <img
          src="/icons/nccc-logo.png"
          alt={alt}
          width={size * 1.6}
          height={size * 1.6}
          className="nccc-logo-mark absolute -left-[30%] -top-[20%] max-w-none"
        />
      </div>
    );
  }

  return (
    // biome-ignore lint/performance/noImgElement: served from /public, no need for next/image
    <img
      src="/icons/nccc-logo.png"
      alt={alt}
      width={size}
      height={size}
      className={cn("nccc-logo-mark rounded-full", className)}
      aria-hidden={decorative ? true : undefined}
    />
  );
}
