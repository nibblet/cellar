import { CigarIcon, GlencairnIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { ProductType } from "@/lib/wheel";

type PhotoFrameProps = {
  src: string;
  alt: string;
  className?: string;
  /** Slots overlaid on top of the photo. Caller positions them via absolute placement. */
  children?: React.ReactNode;
};

/**
 * Sepia-treated photo container with overlay slots. The photo itself is
 * absolutely positioned beneath any children, so the caller can drop
 * member tags / chips / status dots on top.
 *
 * Children are wrapped in a relative-positioned layer above the photo, so
 * they can use `absolute top-X / bottom-Y` placement against the frame.
 */
export function PhotoFrame({ src, alt, className, children }: PhotoFrameProps) {
  return (
    <div
      className={cn(
        "nccc-photo-frame nccc-photo-frame--sepia relative w-full h-full overflow-hidden",
        className,
      )}
    >
      {/* biome-ignore lint/performance/noImgElement: signed URLs vary per-request */}
      <img src={src} alt={alt} className="nccc-photo nccc-photo--sepia absolute inset-0" />
      {children ? <div className="absolute inset-0">{children}</div> : null}
    </div>
  );
}

type PhotoPlaceholderProps = {
  productType: ProductType;
  className?: string;
  children?: React.ReactNode;
};

/**
 * Stylized placeholder card for products that don't yet have a
 * member-contributed photo. Sepia gradient + faintly-etched cigar or
 * glencairn glyph + NCCC watermark. Reads as intentional, not
 * "missing image".
 *
 * Overlay slots work identically to PhotoFrame so the caller can drop
 * the same member-tag / chips / ember-dot composition on top.
 */
export function PhotoPlaceholder({ productType, className, children }: PhotoPlaceholderProps) {
  return (
    <div
      className={cn(
        "relative w-full h-full overflow-hidden",
        "bg-gradient-to-br from-surface via-surface-2 to-surface",
        className,
      )}
      aria-hidden="true"
    >
      {/* Centered etched glyph, faintly drawn */}
      <div className="absolute inset-0 flex items-center justify-center text-foreground-subtle/30">
        {productType === "cigar" ? (
          <CigarIcon size={140} className="rotate-[-12deg]" />
        ) : (
          <GlencairnIcon size={140} />
        )}
      </div>

      {/* Subtle printed-watermark */}
      <div className="absolute bottom-3 right-3 text-[10px] tracking-[0.3em] uppercase text-foreground-subtle/50 font-medium">
        NCCC
      </div>

      {children ? <div className="absolute inset-0">{children}</div> : null}
    </div>
  );
}
