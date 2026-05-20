import Link from "next/link";
import { Card } from "@/components/primitives";
import type { FeedEntry } from "@/lib/feed/queries";

type TastingCardProps = {
  entry: FeedEntry;
  signedHero: string | null;
};

/**
 * One row of the feed: small sepia thumb, product title, member tag, recommend
 * dot, and a chip preview. Tap anywhere → product detail.
 */
export function TastingCard({ entry, signedHero }: TastingCardProps) {
  return (
    <Link href={`/products/${entry.product_id}`} className="block">
      <Card className="hover:bg-surface-2 transition-colors">
        <div className="flex gap-3">
          {signedHero ? (
            // biome-ignore lint/performance/noImgElement: signed URLs vary per-request
            <img
              src={signedHero}
              alt=""
              className="w-16 h-16 rounded-[10px] object-cover nccc-photo nccc-photo--sepia"
            />
          ) : (
            <div className="w-16 h-16 rounded-[10px] bg-surface-2 border border-border" />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span
                className={entry.recommend ? "text-ember-500" : "text-foreground-subtle"}
                aria-hidden="true"
              >
                ●
              </span>
              <span className="text-sm font-medium text-foreground truncate">
                {entry.display_name}
              </span>
              <span className="text-xs text-foreground-subtle uppercase tracking-widest ml-auto">
                {entry.product_type}
              </span>
            </div>

            <p className="text-base text-foreground mt-1 truncate">{entry.product_name}</p>
            {entry.product_brand ? (
              <p className="text-xs text-foreground-muted truncate">{entry.product_brand}</p>
            ) : null}

            {entry.chips.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {entry.chips.slice(0, 3).map((c) => (
                  <span
                    key={c}
                    className="px-1.5 py-0.5 rounded-full bg-surface-2 text-xs text-foreground-muted"
                  >
                    {c}
                  </span>
                ))}
              </div>
            ) : null}

            {entry.note ? (
              <p className="text-sm text-foreground italic mt-1.5 truncate">"{entry.note}"</p>
            ) : null}
          </div>
        </div>
      </Card>
    </Link>
  );
}
