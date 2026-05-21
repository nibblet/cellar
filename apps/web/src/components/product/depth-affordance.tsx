import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/primitives";

/**
 * "Open the depth" entry point on the product detail face. Lives below
 * Pairs With and the Construction strip. When the product has no
 * trait_vector (e.g., a draft created via capture that hasn't aggregated
 * yet) the card renders disabled — there's nothing to plot.
 */
export function DepthAffordance({
  productId,
  available,
}: {
  productId: string;
  available: boolean;
}) {
  if (!available) {
    return (
      <Card aria-disabled="true" className="border-dashed border-border text-foreground-muted">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-foreground-subtle">
              The depth view
            </p>
            <p className="text-sm mt-0.5 italic">
              "Not yet measured, sir. Log a tasting and the shape fills in."
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-foreground-subtle shrink-0" aria-hidden="true" />
        </div>
      </Card>
    );
  }

  return (
    <Link href={`/products/${productId}/depth`} className="block group">
      <Card className="hover:bg-surface-2 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-foreground-subtle">
              The depth view
            </p>
            <p className="text-sm mt-0.5 italic text-foreground-muted">
              "Open the radar — the shape of this one."
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
