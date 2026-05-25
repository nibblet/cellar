import Link from "next/link";
import { Card, Divider } from "@/components/primitives";
import type { AdjacentProduct } from "@/lib/similarity/suggest-adjacent";

type YouMightAlsoLikeProps = {
  products: AdjacentProduct[];
};

export function YouMightAlsoLike({ products }: YouMightAlsoLikeProps) {
  if (products.length === 0) return null;

  return (
    <div className="mt-8">
      <Divider label="You might also like" />
      <div className="-mx-6 mt-3 flex gap-3 overflow-x-auto px-6 pb-1 snap-x snap-mandatory">
        {products.map((p) => (
          <Link
            key={p.product_id}
            href={`/products/${p.product_id}`}
            className="snap-start shrink-0 w-[168px]"
          >
            <Card className="h-full hover:bg-surface-2 transition-colors">
              <p className="text-sm text-foreground line-clamp-3 leading-snug">{p.name}</p>
              {p.brand ? (
                <p className="text-xs text-foreground-muted truncate mt-1">{p.brand}</p>
              ) : null}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
