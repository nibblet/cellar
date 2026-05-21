import { ChevronRight } from "lucide-react";
import { Card } from "@/components/primitives";

/**
 * Scaffolded "Open the depth" entry point (UX-3). The radar-chart depth
 * view itself is Tier 2 #4 in the roadmap; this card lands the affordance
 * now so members start to learn there's something deeper waiting.
 *
 * Disabled-link styling: visually distinct from a real CTA, no href yet.
 * Once the depth view ships, swap to a Link with the proper href.
 */
export function DepthAffordance() {
  return (
    <Card aria-disabled="true" className="border-dashed border-border text-foreground-muted">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-foreground-subtle">
            The depth view
          </p>
          <p className="text-sm mt-0.5 italic">
            "Tap here when it lands — radar, member adjustments, the works."
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-foreground-subtle shrink-0" aria-hidden="true" />
      </div>
    </Card>
  );
}
