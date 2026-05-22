import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/primitives";

/**
 * Entry point to the depth view on the product detail face.
 * Always clickable — the depth view shows construction + correction affordance
 * even when there's no flavor data yet. The `available` prop controls whether
 * Winston's teaser mentions the flavor profile or not.
 */
export function DepthAffordance({
  productId,
  available,
}: {
  productId: string;
  available: boolean;
}) {
  return (
    <Link href={`/products/${productId}/depth`} className="block group">
      <Card className="hover:bg-surface-2 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-foreground-subtle">
              The depth view
            </p>
            <p className="text-sm mt-0.5 italic text-foreground-muted">
              {available
                ? "Full spec, flavor profile, and more."
                : "Full spec and construction details."}
            </p>
          </div>
          <ChevronRight
            className="w-5 h-5 text-accent shrink-0 group-hover:translate-x-0.5 transition-transform"
            aria-hidden="true"
          />
        </div>
      </Card>
    </Link>
  );
}
