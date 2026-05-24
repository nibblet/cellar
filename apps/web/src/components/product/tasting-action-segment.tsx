import Link from "next/link";
import { cn } from "@/lib/utils";

type TastingActionSegmentProps = {
  productId: string;
  hasTasting: boolean;
  event?: string;
};

/**
 * Segmented brass control — Edit/Recommend vs Open a Session at equal weight.
 * Single accent surface; honors "one brass primary per screen" as one component.
 */
export function TastingActionSegment({ productId, hasTasting, event }: TastingActionSegmentProps) {
  const qs = event ? `?event=${encodeURIComponent(event)}` : "";
  const recommendHref = `/products/${productId}/recommend${qs}`;
  const sessionHref = `/products/${productId}/session${qs}`;

  return (
    <div
      className="grid grid-cols-2 rounded-[12px] border border-accent overflow-hidden bg-accent"
      role="group"
      aria-label="Tasting actions"
    >
      <Link
        href={recommendHref}
        className={cn(
          "h-14 flex items-center justify-center text-sm font-medium text-ink-900",
          "hover:bg-accent-hover transition-colors",
          "border-r border-ink-900/10",
        )}
      >
        {hasTasting ? "Edit tasting" : "Recommend"}
      </Link>
      <Link
        href={sessionHref}
        className={cn(
          "h-14 flex items-center justify-center text-sm font-medium text-ink-900",
          "hover:bg-accent-hover transition-colors",
        )}
      >
        Open session
      </Link>
    </div>
  );
}
