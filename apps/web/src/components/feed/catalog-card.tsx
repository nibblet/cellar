import Link from "next/link";
import { CellarCardControls } from "@/components/cellar";
import type { CellarRow } from "@/lib/cellar/types";
import type { CatalogEntry } from "@/lib/feed/catalog-queries";
import { PhotoFrame, PhotoPlaceholder } from "./photo-frame";

type CatalogCardProps = {
  entry: CatalogEntry;
  signedHero: string | null;
  cellarState?: CellarRow | null;
};

/**
 * Catalog-browse card used by the Cigars / Bourbons feed tabs. Same
 * photo-as-card vocabulary as the chronological feed, minus the member
 * tag / chips / ember dot since these are unrecommended catalog rows.
 *
 * If the product matches the viewer's preferences, the same FOR YOU pill
 * lights at the top-left of the photo. Otherwise the card stays clean.
 */
export function CatalogCard({ entry, signedHero, cellarState }: CatalogCardProps) {
  const Overlays = entry.matches_preferences ? (
    <div className="absolute top-3 left-3 z-10">
      <span className="px-2 py-0.5 rounded-full text-[10px] tracking-widest uppercase text-paper-50 bg-ink-900/40 border border-paper-50/40 backdrop-blur-[2px]">
        For you
      </span>
    </div>
  ) : null;

  return (
    <Link href={`/products/${entry.product_id}`} className="block group">
      <article className="mx-0.5 rounded-[16px] border border-border bg-surface overflow-hidden transition-shadow group-hover:shadow-[0_2px_12px_rgba(0,0,0.12)]">
        <div className="relative aspect-[4/5]">
          {signedHero ? (
            <PhotoFrame src={signedHero} alt={entry.name}>
              {Overlays}
            </PhotoFrame>
          ) : entry.catalog_image_url ? (
            // Public catalog mirror — no signing needed (product-catalog bucket is public)
            <div className="relative w-full h-full bg-surface">
              {/* biome-ignore lint/performance/noImgElement: external public catalog URL */}
              <img
                src={entry.catalog_image_url}
                alt={entry.name}
                className="absolute inset-0 w-full h-full object-contain p-4"
              />
              {Overlays}
            </div>
          ) : (
            <PhotoPlaceholder productType={entry.type}>{Overlays}</PhotoPlaceholder>
          )}
        </div>

        <div className="px-3.5 py-3 min-w-0 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            {entry.brand_family ?? entry.brand ? (
              <p className="text-[10px] uppercase tracking-widest text-foreground-subtle truncate mb-0.5">
                {entry.brand_family ?? entry.brand}
              </p>
            ) : null}
            <p className="text-[15px] font-medium text-foreground truncate leading-snug">
              {entry.name}
            </p>
            {entry.subtitle ? (
              <p className="text-[11px] text-foreground-muted truncate mt-0.5">{entry.subtitle}</p>
            ) : null}
          </div>
          {cellarState != null ? (
            <div className="shrink-0 mt-0.5">
              <CellarCardControls productId={entry.product_id} initialState={cellarState} />
            </div>
          ) : null}
        </div>
      </article>
    </Link>
  );
}
