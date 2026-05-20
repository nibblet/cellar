import { CigarIcon, GlencairnIcon } from "@/components/icons";
import type { ProductType } from "@/lib/wheel";

type RecommendBarProps = {
  productType: ProductType;
  recommendCount: number;
  memberCount: number;
};

/**
 * Visceral row of icons sized by membership: lit/full = recommended,
 * dim/empty = passed. Capped at 12 visible icons (the club's full size);
 * a small badge appears if a product has somehow accumulated more.
 */
export function RecommendBar({ productType, recommendCount, memberCount }: RecommendBarProps) {
  if (memberCount === 0) {
    return (
      <p className="text-sm text-foreground-subtle">
        Nobody's tried this yet. Be the first to recommend it.
      </p>
    );
  }

  const total = Math.min(memberCount, 12);
  const lit = Math.min(recommendCount, total);
  const Icon = productType === "cigar" ? CigarIcon : GlencairnIcon;
  const variantProp =
    productType === "cigar" ? ({ lit: true } as const) : ({ full: true } as const);
  const dimProp = productType === "cigar" ? ({ lit: false } as const) : ({ full: false } as const);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        {Array.from({ length: lit }, (_, i) => `lit-${i}`).map((key) => (
          <Icon key={key} {...variantProp} size={28} />
        ))}
        {Array.from({ length: total - lit }, (_, i) => `dim-${i}`).map((key) => (
          <Icon key={key} {...dimProp} size={28} />
        ))}
        <span className="text-sm text-foreground-muted ml-2 tabular-nums">
          {recommendCount} of {memberCount}
        </span>
      </div>
      <p className="text-xs uppercase tracking-widest text-foreground-subtle">
        recommend to the club
      </p>
    </div>
  );
}
