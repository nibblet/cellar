import Link from "next/link";
import type { CatalogGroup } from "@/lib/feed/catalog-queries";
import { Divider } from "@/components/primitives";
import { makerSlugForCatalogGroup } from "@/lib/makers/browse";

type Props = {
  group: CatalogGroup;
};

/**
 * Etched brand-family divider; links to the maker page when a slug resolves.
 */
export function BrandFamilyDivider({ group }: Props) {
  const label = group.brand_family;
  if (!label) return null;

  const slug = makerSlugForCatalogGroup(group);
  if (!slug) {
    return <Divider label={label} />;
  }

  return (
    <div className="nccc-divider">
      <Link
        href={`/makers/${slug}`}
        className="text-foreground-muted hover:text-foreground transition-colors"
      >
        {label}
      </Link>
    </div>
  );
}
