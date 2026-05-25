import Link from "next/link";
import type { FeedEntry } from "@/lib/feed/queries";
import { PhotoFrame, PhotoPlaceholder } from "./photo-frame";

type TastingCardProps = {
  entry: FeedEntry;
  signedHero: string | null;
  forYou?: boolean;
};

/**
 * Photo-as-card feed entry (UX-1, 2026-05-20).
 *
 * Layout:
 *   ┌──────────────────────────────┐
 *   │ [SEPIA PHOTO]            ● ←┄│ ember dot top-right (when recommended)
 *   │                              │
 *   │                              │
 *   │ Paul C    [cocoa] [leather] ←│ member tag bottom-left, chips bottom-right,
 *   └──────────────────────────────┘ over a dark gradient scrim
 *     Padron 1964 Anniversary        ← product name strip below the photo
 *     Padron · CIGAR                   brand + type meta
 *     "Stronger than I expected."     ← optional italic note
 *
 * If no member photo exists, PhotoPlaceholder renders a stylized
 * sepia-gradient card with an etched cigar/glencairn glyph and NCCC
 * watermark — overlays compose identically.
 */
export function TastingCard({ entry, signedHero, forYou = false }: TastingCardProps) {
  const Overlays = (
    <>
      {/* Ember dot — top-right, only when this member recommended */}
      {entry.recommend ? (
        <div className="absolute top-3 right-3 z-10" role="img" aria-label="Recommended">
          <span className="block w-3 h-3 rounded-full bg-ember-500 shadow-[0_0_10px_var(--ember-500)] ring-2 ring-paper-50/50" />
        </div>
      ) : null}

      {/* FOR YOU pill — top-left, only when this product matches the viewer's
          preferences and the tasting is someone else's. Etched-glass style,
          intentionally subtle (positives-only: doesn't shout). */}
      {forYou ? (
        <div className="absolute top-3 left-3 z-10">
          <span className="px-2 py-0.5 rounded-full text-[10px] tracking-widest uppercase text-paper-50 bg-ink-900/40 border border-paper-50/40 backdrop-blur-[2px]">
            For you
          </span>
        </div>
      ) : null}

      {/* Bottom scrim + member tag + chips */}
      <div className="absolute inset-x-0 bottom-0 p-3 pt-12 bg-gradient-to-t from-ink-900/70 via-ink-900/40 to-transparent">
        <div className="flex items-end justify-between gap-3">
          <span
            className="font-display italic text-base text-paper-50 drop-shadow-md truncate min-w-0"
            title={entry.display_name}
          >
            {entry.display_name}
          </span>

          {entry.chips.length > 0 ? (
            <div className="flex flex-wrap gap-1 justify-end shrink-0 max-w-[60%]">
              {entry.chips.slice(0, 3).map((chip) => (
                <span
                  key={chip}
                  className="px-2 py-0.5 rounded-full text-[11px] text-paper-50 bg-ink-900/40 border border-paper-50/30 backdrop-blur-[2px]"
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  return (
    <Link href={`/products/${entry.product_id}`} className="block group">
      <article className="mx-0.5 rounded-[16px] border border-border bg-surface overflow-hidden transition-shadow group-hover:shadow-[0_2px_12px_rgba(0,0,0,0.12)]">
        {/* Photo area — taller-than-wide (Polaroid-ish) for editorial feel */}
        <div className="relative aspect-[4/5]">
          {signedHero ? (
            <PhotoFrame src={signedHero} alt={entry.product_name}>
              {Overlays}
            </PhotoFrame>
          ) : (
            <PhotoPlaceholder productType={entry.product_type}>{Overlays}</PhotoPlaceholder>
          )}
        </div>

        {/* Compact info strip below the photo */}
        <div className="px-3.5 py-3 flex items-baseline justify-between gap-3 min-w-0">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium text-foreground truncate leading-snug">
              {entry.product_name}
            </p>
            <p className="text-[11px] text-foreground-muted truncate mt-0.5">
              {entry.product_brand ? `${entry.product_brand} · ` : ""}
              <span className="uppercase tracking-widest text-foreground-subtle">
                {entry.product_type}
              </span>
            </p>
          </div>
        </div>

        {entry.note ? (
          <p className="px-3.5 pb-3 -mt-1.5 text-[13px] text-foreground italic truncate">
            "{entry.note}"
          </p>
        ) : null}
      </article>
    </Link>
  );
}
