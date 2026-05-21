"use client";

import { useState } from "react";
import { PhotoFrame, PhotoPlaceholder } from "@/components/feed";
import { cn } from "@/lib/utils";
import type { ProductType } from "@/lib/wheel";

export type ProductHeroImage = {
  url: string;
  contributor: string | null;
};

type ProductHeroProps = {
  productType: ProductType;
  productName: string;
  /** Signed, member-contributed photos, ordered hero-first then newest. */
  userImages: ProductHeroImage[];
  /** Manufacturer / catalog image URL (typically from specs.image_url). Used as a fallback. */
  stockUrl: string | null;
};

/**
 * Product-detail photo treatment.
 *
 * Hierarchy:
 *   1. Member-contributed photos (sepia, "photographed by X" credit) with a
 *      tap-to-swap thumbnail strip when there are 2+.
 *   2. Stock / catalog photo (no sepia, "catalog" caption) — the gentle nudge
 *      that snapping a photo replaces this with a real one.
 *   3. Etched placeholder.
 */
export function ProductHero({ productType, productName, userImages, stockUrl }: ProductHeroProps) {
  if (userImages.length > 0) {
    return <UserImageGallery productName={productName} images={userImages} />;
  }

  if (stockUrl) {
    return <StockHero productName={productName} url={stockUrl} />;
  }

  return (
    <div className="relative aspect-[4/5] rounded-[16px] border border-border overflow-hidden">
      <PhotoPlaceholder productType={productType} />
    </div>
  );
}

function UserImageGallery({
  productName,
  images,
}: {
  productName: string;
  images: ProductHeroImage[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  return (
    <div>
      <div className="relative aspect-[4/5] rounded-[16px] border border-border overflow-hidden">
        <PhotoFrame src={active.url} alt={productName}>
          {active.contributor ? (
            <div className="absolute inset-x-0 bottom-0 p-3 pt-10 bg-gradient-to-t from-ink-900/65 via-ink-900/30 to-transparent">
              <p className="font-display italic text-sm text-paper-50 drop-shadow-md">
                photographed by {active.contributor}
              </p>
            </div>
          ) : null}
        </PhotoFrame>
      </div>

      {images.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => {
            const selected = i === activeIndex;
            return (
              <button
                key={img.url}
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-pressed={selected}
                aria-label={
                  img.contributor ? `Show photo by ${img.contributor}` : "Show member photo"
                }
                className={cn(
                  "shrink-0 w-14 h-[68px] rounded-lg overflow-hidden border-2 transition-all",
                  selected
                    ? "border-accent opacity-100"
                    : "border-transparent opacity-70 hover:opacity-100",
                )}
              >
                <PhotoFrame src={img.url} alt="" />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function StockHero({ productName, url }: { productName: string; url: string }) {
  return (
    <div className="relative aspect-[4/5] rounded-[16px] border border-border overflow-hidden bg-surface">
      {/* biome-ignore lint/performance/noImgElement: external catalog URL, not in our storage */}
      <img
        src={url}
        alt={productName}
        className="absolute inset-0 w-full h-full object-contain p-6"
      />
      <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-full text-[10px] tracking-widest uppercase text-foreground-subtle bg-paper-50/80 border border-border backdrop-blur-[1px]">
        Catalog
      </div>
    </div>
  );
}
