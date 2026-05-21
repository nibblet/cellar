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
  /** Manufacturer / catalog image URL (typically from specs.image_url). */
  stockUrl: string | null;
};

type Slide =
  | { kind: "user"; url: string; contributor: string | null }
  | { kind: "stock"; url: string };

/**
 * Product-detail photo treatment.
 *
 * Members' photos and the catalog photo coexist in one tap-to-swap gallery.
 * User photos render with the sepia archive treatment + "photographed by X"
 * credit; the catalog slide drops the sepia, fits via object-contain on the
 * surface background, and wears a small "Catalog" label so the difference
 * is unmistakable. With no images at all we fall back to the etched
 * placeholder.
 */
export function ProductHero({ productType, productName, userImages, stockUrl }: ProductHeroProps) {
  const slides: Slide[] = [
    ...userImages.map((img) => ({
      kind: "user" as const,
      url: img.url,
      contributor: img.contributor,
    })),
    ...(stockUrl ? [{ kind: "stock" as const, url: stockUrl }] : []),
  ];

  if (slides.length === 0) {
    return (
      <div className="relative aspect-[4/5] rounded-[16px] border border-border overflow-hidden">
        <PhotoPlaceholder productType={productType} />
      </div>
    );
  }

  return <Gallery slides={slides} productName={productName} />;
}

function Gallery({ slides, productName }: { slides: Slide[]; productName: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = slides[activeIndex] ?? slides[0];

  return (
    <div>
      <div className="relative aspect-[4/5] rounded-[16px] border border-border overflow-hidden bg-surface">
        {active.kind === "user" ? (
          <PhotoFrame src={active.url} alt={productName}>
            {active.contributor ? (
              <div className="absolute inset-x-0 bottom-0 p-3 pt-10 bg-gradient-to-t from-ink-900/65 via-ink-900/30 to-transparent">
                <p className="font-display italic text-sm text-paper-50 drop-shadow-md">
                  photographed by {active.contributor}
                </p>
              </div>
            ) : null}
          </PhotoFrame>
        ) : (
          <>
            {/* biome-ignore lint/performance/noImgElement: external catalog URL, not in our storage */}
            <img
              src={active.url}
              alt={productName}
              className="absolute inset-0 w-full h-full object-contain p-6"
            />
            <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-full text-[10px] tracking-widest uppercase text-foreground-subtle bg-paper-50/80 border border-border backdrop-blur-[1px]">
              Catalog
            </div>
          </>
        )}
      </div>

      {slides.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {slides.map((slide, i) => {
            const selected = i === activeIndex;
            const label =
              slide.kind === "user"
                ? slide.contributor
                  ? `Show photo by ${slide.contributor}`
                  : "Show member photo"
                : "Show catalog photo";
            return (
              <button
                key={`${slide.kind}-${slide.url}`}
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-pressed={selected}
                aria-label={label}
                className={cn(
                  "relative shrink-0 w-14 h-[68px] rounded-lg overflow-hidden border-2 transition-all",
                  selected
                    ? "border-accent opacity-100"
                    : "border-transparent opacity-70 hover:opacity-100",
                )}
              >
                {slide.kind === "user" ? (
                  <PhotoFrame src={slide.url} alt="" />
                ) : (
                  <>
                    {/* biome-ignore lint/performance/noImgElement: external catalog URL */}
                    <img
                      src={slide.url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-contain p-1.5 bg-surface"
                    />
                    <span className="absolute bottom-0 inset-x-0 text-[8px] uppercase tracking-widest text-center text-foreground-subtle bg-paper-50/80 leading-tight py-px">
                      Catalog
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
