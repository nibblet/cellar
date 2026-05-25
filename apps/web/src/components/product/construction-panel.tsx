import { Card } from "@/components/primitives";
import {
  buildBourbonConstructionRows,
  buildCigarConstructionRows,
} from "@/lib/catalog/normalize-specs";
import type { ProductType } from "@/lib/wheel";

type Specs = Record<string, unknown>;

type ConstructionPanelProps = {
  productType: ProductType;
  specs: Specs | null | undefined;
  /** Used to hide expression labels already stated in the product name. */
  productName?: string | null;
};

/**
 * CONSTRUCTION panel for the product detail page (UX-3). Promotes the
 * structural facts about how the bottle / cigar is made above the catch-all
 * facts strip. Collapsed smoker/drinker-first rows; empty fields are skipped.
 */
export function ConstructionPanel({ productType, specs, productName }: ConstructionPanelProps) {
  const rows =
    productType === "cigar"
      ? buildCigarConstructionRows(specs)
      : buildBourbonConstructionRows(specs, { productName });

  if (rows.length === 0) {
    return (
      <Card>
        <p className="text-sm text-foreground-subtle">
          Winston hasn't catalogued how this one's made yet.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(({ key, label, value }) => (
          <div key={key} className="contents">
            <dt className="text-foreground-subtle uppercase tracking-widest text-[10px] self-baseline pt-0.5">
              {label}
            </dt>
            <dd className="text-foreground break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
